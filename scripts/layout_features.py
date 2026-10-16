"""Accepted pilot v4: text geometry and background-independent visual gutters.
Scores measure compatibility, not calibrated probability. No sample overrides.
"""

import time, re
from pathlib import Path
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks
from rapidocr_onnxruntime import RapidOCR
SESSION = None
ENGINE = None

def initialize(model_path, threads):
    global SESSION, ENGINE
    options = ort.SessionOptions()
    options.intra_op_num_threads = threads
    options.inter_op_num_threads = 1
    options.log_severity_level = 3
    SESSION = ort.InferenceSession(str(model_path), sess_options=options, providers=['CPUExecutionProvider'])
    ENGINE = RapidOCR(intra_op_num_threads=threads, inter_op_num_threads=1,
                      det_limit_side_len=640, det_limit_type='max')
    cv2.setNumThreads(1)

def analyze_image(path):
    started = time.perf_counter()
    with Image.open(path) as image:
        original_size = image.size
        image = ImageOps.exif_transpose(image)
        if image.mode == 'RGBA':
            background = Image.new('RGBA', image.size, 'white')
            image = Image.alpha_composite(background, image)
        image = image.convert('RGB')
    decode_seconds = time.perf_counter() - started
    width, height = image.size
    label, model_confidence = classify(SESSION, image)
    correction = (-label) % 360
    upright = image.rotate(-correction, expand=True)
    thumb, arr, boxes = detect(ENGINE, upright)
    selected = sorted(boxes, key=lambda b: np.ptp(b[:, 1])*min(np.ptp(b[:, 0]), 300), reverse=True)[:24]
    votes = []
    if selected:
        _, votes, _ = ENGINE.text_cls(ENGINE.get_crop_img_list(arr, selected))
    strong = [int(name) for name, confidence in votes if confidence > .8]
    fraction = sum(name == 180 for name in strong) / max(1, len(strong))
    fallback = False
    if len(strong) >= 5 and (fraction <= .25 or fraction >= .75):
        if fraction >= .75:
            correction = (correction + 180) % 360
            upright = image.rotate(-correction, expand=True)
            thumb, arr, boxes = detect(ENGINE, upright)
    # Keep the document-orientation model as the fast default. The four-way
    # OCR fallback is accurate on the pilot but dominates full-corpus runtime;
    # uncertain cases remain explicitly marked for later review.
    lines = [[box.tolist(), 'detected', 1.] for box in boxes]
    candidate = columns(thumb, lines)
    # Use the accepted 25%-92% body-only global projection as the initial candidate.
    profile = np.zeros(500)
    for box, _, _ in lines:
        b = np.asarray(box) / thumb.size
        x0, y0 = b.min(axis=0); x1, y1 = b.max(axis=0)
        if y0 >= .25 and y1 <= .92 and .045 < x1-x0 < .6:
            profile[max(0, int(x0*500)):min(500, int(x1*500)+1)] += 1
    profile = gaussian_filter1d(profile, 3)
    profile /= max(float(np.percentile(profile, 80)), 1)
    peaks, _ = find_peaks(-profile, distance=80, prominence=.15)
    oldcuts = [float(x/500) for x in peaks if .14 < x/500 < .86 and profile[x] < .23]
    cuts, visual = refine(thumb, oldcuts)
    compatibility, score_evidence = score(thumb, cuts, lines)
    corrected_width, corrected_height = (height, width) if correction % 180 else (width, height)
    return dict(rotation_clockwise=correction, original_size=list(original_size),
                corrected_width=corrected_width, corrected_height=corrected_height,
                aspect_ratio=corrected_width/corrected_height, palette=palette(upright),
                orientation=dict(model_label=label, model_confidence=model_confidence,
                                 strong_textline_votes=len(strong), upside_down_vote_fraction=fraction,
                                 ocr_fallback=False, needs_review=len(strong)<5 or model_confidence<.8),
                layout=dict(candidate_columns=len(cuts)+1, cuts_normalized=cuts,
                            compatibility_score=compatibility, confidence_type='uncalibrated_compatibility_score',
                            needs_review=True, visual_evidence=visual, score_evidence=score_evidence),
                timings=dict(decode_seconds=decode_seconds, total_seconds=time.perf_counter()-started))

def palette(im):
    small=im.copy();small.thumbnail((360,360))
    q=small.quantize(colors=8,method=Image.Quantize.MEDIANCUT)
    pal=q.getpalette(); total=small.width*small.height
    colors=[dict(hex='#%02x%02x%02x'%tuple(pal[k*3:k*3+3]),fraction=round(n/total,4)) for n,k in sorted(q.getcolors(),reverse=True)]
    arr=np.asarray(small).reshape(-1,3).astype(float)
    mask=(arr.max(axis=1)-arr.min(axis=1)>35)&(arr.max(axis=1)>60)&(arr.min(axis=1)<225)
    accent=[]
    if mask.sum()>10:
        ap=Image.fromarray(arr[mask].astype('uint8').reshape(-1,1,3)).quantize(colors=5)
        pp=ap.getpalette()
        accent=[dict(hex='#%02x%02x%02x'%tuple(pp[k*3:k*3+3]),fraction_of_colored_pixels=round(n/mask.sum(),4)) for n,k in sorted(ap.getcolors(),reverse=True)]
    return dict(area_colors=colors,accent_colors=accent,colored_fraction=round(float(mask.mean()),4))

def orientation(engine,im):
    scores=[];outputs=[]
    for angle in [0,90,180,270]:
        candidate=im.rotate(-angle,expand=True)
        candidate.thumbnail((800,800))
        arr=np.asarray(candidate)[:,:,::-1].copy()
        boxes,_=engine.text_det(arr)
        boxes=[] if boxes is None else list(boxes)
        horizontal=[b for b in boxes if np.ptp(b[:,0])>2*np.ptp(b[:,1])]
        selected=sorted(horizontal,key=lambda b:np.ptp(b[:,1])*min(np.ptp(b[:,0]),300),reverse=True)[:24]
        recognized,_=engine.text_rec(engine.get_crop_img_list(arr,selected)) if selected else ([],0)
        score=sum(min(60,len(re.sub(r'[^A-Za-z]','',text)))*float(conf)**3 for text,conf in recognized if conf>.6)
        scores.append(score)
        outputs.append((candidate,[[b.tolist(),'detected',1.0] for b in horizontal]))
    order=np.argsort(scores)[::-1];best=int(order[0]);margin=(scores[best]-scores[int(order[1])])/max(scores[best],1)
    return best*90,scores,margin,outputs[best]

def columns(im,result):
    w,h=im.size; profile=np.zeros(w); n=0
    for box,text,conf in result:
        b=np.array(box);x0,x1=b[:,0].min(),b[:,0].max();y=b[:,1].mean()
        if .20*h<y<.92*h and .045*w<x1-x0<.6*w and conf>.65:
            profile[max(0,int(x0)):min(w,int(x1)+1)]+=1;n+=1
    profile=gaussian_filter1d(profile,max(1,w*.006))
    scale=max(float(np.percentile(profile,80)),1);p=profile/scale
    peaks,_=find_peaks(-p,distance=int(w*.16),prominence=.15)
    cuts=[int(x) for x in peaks if .14*w<x<.86*w and p[x]<.23]
    cuts=sorted(cuts)[:4]
    return dict(estimated_columns=len(cuts)+1,cuts_normalized=[round(x/w,4) for x in cuts],text_lines=n,gutter_strength=[round(float(1-p[x]),3) for x in cuts],status='heuristic_unvalidated')

def classify(session,im):
    a=np.asarray(im);h,w=a.shape[:2];scale=256/min(h,w)
    a=cv2.resize(a,(int(w*scale),int(h*scale)));h,w=a.shape[:2]
    a=a[(h-224)//2:(h-224)//2+224,(w-224)//2:(w-224)//2+224]
    a=(a.astype('float32')/255-np.array([.485,.456,.406],dtype='float32'))/np.array([.229,.224,.225],dtype='float32')
    scores=session.run(None,{session.get_inputs()[0].name:a.transpose(2,0,1)[None]})[0][0]
    return int(np.argmax(scores))*90,float(max(scores))

def detect(engine,im):
    thumb=im.copy();thumb.thumbnail((800,800));arr=np.asarray(thumb)[:,:,::-1].copy()
    b,_=engine.text_det(arr);b=[] if b is None else list(b)
    boxes=[x for x in b if np.ptp(x[:,0])>2*np.ptp(x[:,1])]
    return thumb,arr,boxes

def features(im):
    im=im.copy();im.thumbnail((800,800));a=np.asarray(im).astype('float32')/255
    h,w=a.shape[:2];a=a[int(h*.25):int(h*.92)]
    # Local variation is independent of whether the paper is white, grey or colored.
    blur=cv2.GaussianBlur(a,(0,0),1.2)
    dx=np.max(np.abs(np.diff(blur,axis=1,prepend=blur[:,:1])),axis=2)
    dy=np.max(np.abs(np.diff(blur,axis=0,prepend=blur[:1])),axis=2)
    texture=gaussian_filter1d(np.mean(np.minimum(dx+dy,.12),axis=0),max(1,w*.004))
    texture/=max(float(np.percentile(texture,65)),1e-6)
    lows,_=find_peaks(-texture,distance=int(w*.09),prominence=.10)
    lows=[int(x) for x in lows if .12<x/w<.88]
    # Persistent vertical edges: panel border / rule, not OCR whitespace.
    edge=(dx>.045).astype('uint8')
    edge=cv2.morphologyEx(edge,cv2.MORPH_CLOSE,np.ones((5,1),np.uint8))
    edge=cv2.morphologyEx(edge,cv2.MORPH_OPEN,np.ones((max(15,int(len(a)*.35)),1),np.uint8))
    support=gaussian_filter1d(edge.mean(axis=0),1)
    peaks,_=find_peaks(support,distance=int(w*.08),height=.08,prominence=.04)
    lines=[int(x) for x in peaks if .12<x/w<.88]
    return dict(texture=texture,texture_lows=lows,line_support=support,line_peaks=lines,width=w)

def refine(im,oldcuts):
 f=features(im);w=f['width'];deep=[x/w for x in f['texture_lows'] if f['texture'][x]<.30]
 strong=[x/w for x in f['line_peaks'] if f['line_support'][x]>=.75]
 cuts=[];reasons=[]
 for old in oldcuts:
  rules=[x for x in strong if abs(x-old)<.07]
  valleys=[x for x in deep if abs(x-old)<.05]
  if rules:new=min(rules,key=lambda x:abs(x-old));reason='persistent_panel_edge'
  elif valleys:new=min(valleys,key=lambda x:abs(x-old));reason='background_independent_low_texture'
  else:new=old;reason='ocr_candidate_retained'
  cuts.append(new);reasons.append(dict(old=old,new=new,evidence=reason))
 additions=[]
 for x in sorted(deep,key=lambda x:float(f['texture'][min(w-1,int(x*w))])):
  if any(abs(x-c)<.10 for c in cuts):continue
  proposal=sorted(cuts+[x]);widths=np.diff([.025]+proposal+[.975])
  if min(widths)>=.18:
   cuts=proposal;additions.append(dict(position=x,evidence='strong_visual_gutter_missing_from_ocr'))
 return [round(x,4) for x in sorted(cuts)],dict(refinements=reasons,additions=additions,deep_texture_candidates=deep,strong_panel_edges=strong)

def score(im,cuts,lines):
 im=im.copy();im.thumbnail((800,800));a=np.asarray(im).astype('float32')/255;h,w=a.shape[:2]
 blur=cv2.GaussianBlur(a,(0,0),1.2)
 dx=np.max(np.abs(np.diff(blur,axis=1,prepend=blur[:,:1])),axis=2)
 dy=np.max(np.abs(np.diff(blur,axis=0,prepend=blur[:1])),axis=2)
 texture=dx+dy;boxes=[]
 for box,_,_ in lines:
  b=np.asarray(box)/[w,h];x0,y0=b.min(axis=0);x1,y1=b.max(axis=0)
  if y0>=.25 and y1<=.92 and .045<x1-x0<.9:boxes.append((x0,y0,x1,y1))
 bands=[]
 for top,bottom in zip(np.linspace(.25,.92,5)[:-1],np.linspace(.25,.92,5)[1:]):
  active=[b for b in boxes if top<(b[1]+b[3])/2<bottom]
  text=np.zeros(w)
  for x0,y0,x1,y1 in active:text[int(x0*w):min(w,int(x1*w)+1)]+=1
  text=gaussian_filter1d(text,max(1,w*.006));text/=max(float(np.percentile(text,80)),1)
  visual=gaussian_filter1d(np.mean(np.minimum(texture[int(top*h):int(bottom*h)],.12),axis=0),max(1,w*.004))
  visual/=max(float(np.percentile(visual,65)),1e-6)
  evidence=[]
  for x in cuts:
   pos=min(w-1,int(x*w));t=float(text[pos]);v=float(visual[pos])
   # An OCR box can falsely bridge smooth background; visual evidence can override it.
   radius=max(2,int(w*.004))
   localedge=dx[int(top*h):int(bottom*h),max(0,pos-radius):min(w,pos+radius+1)]
   rule=float(np.max((localedge>.045).mean(axis=0))) if localedge.size else 0.
   evidence.append(dict(position=x,text_density=round(t,4),visual_texture=round(v,4),vertical_rule_support=round(rule,4),compatible=bool(rule>.6 or v<.35 or (t<.23 and v<1.2))))
  bands.append(dict(top=float(top),bottom=float(bottom),cuts=evidence))
 counts=[];supports=[]
 for left,right in zip([.025]+cuts,cuts+[.975]):
  count=sum(x0>=left-.01 and x1<=right+.01 and x1-x0<.6 for x0,y0,x1,y1 in boxes)
  tile=texture[int(.25*h):int(.92*h),int((left+.015)*w):int((right-.015)*w)]
  content=float((tile>.015).mean()) if tile.size else 0
  counts.append(count);supports.append(bool(count>=3 or content>.035))
 checks=[c['compatible'] for band in bands for c in band['cuts']]
 compatibility=float(np.mean(checks)) if checks else 1.
 support=float(np.mean(supports));return round(compatibility*support,3),dict(bands=bands,column_text_counts=counts,column_content_support=supports,cut_compatibility=compatibility,content_support_fraction=support)
