import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Circle, CircleDot, Clock3, CheckCircle2, Plus } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { byBoardOrder, moveProjectItem, type BoardItem, projectColumns } from './board-model';
import { createDragBody, stepDragBody, type DragBody } from './drag-physics';

type Column = typeof projectColumns[number];
interface Props<T extends BoardItem> {
  items: T[]; columns: readonly Column[]; disabled?: boolean;
  renderItem: (item:T) => ReactNode;
  onMove: (id:string,status:string,index:number) => void;
  onAdd: (status:string) => void;
  labelItem: (item:T) => string;
}
interface Carry<T> {
  id:string; pointerId:number; x:number; y:number; offsetX:number; offsetY:number;
  body:DragBody; overlay:HTMLElement; height:number; snapshot:T[];
  phase:'drag'|'settle'; cancelled:boolean; time:number; released:number;
}
export function WeightedTaskGrid<T extends BoardItem>({ items,columns,disabled,renderItem,onMove,onAdd,labelItem }:Props<T>) {
  const {t}=useLang(); const reduced=useReducedMotion();
  const root=useRef<HTMLDivElement>(null); const live=useRef<HTMLParagraphElement>(null);
  const [preview,setPreview]=useState<T[]|null>(null);
  const [picked,setPicked]=useState<string|null>(null);
  const [over,setOver]=useState<string|null>(null);
  const carry=useRef<Carry<T>|null>(null);
  const pending=useRef<{id:string;x:number;y:number;pointerId:number}|null>(null);
  const keyboard=useRef<{id:string;snapshot:T[]}|null>(null);
  const frame=useRef(0); const suppressClick=useRef(false);
  const latest=useRef({items,preview,onMove,disabled,reduced,t});
  latest.current={items,preview,onMove,disabled,reduced,t};
  const rows=preview??items;
  const say=(message:string)=>{if(live.current)live.current.textContent=message;};

  useEffect(()=>{
    const el=root.current!;
    const t=(zh:string,en:string)=>latest.current.t(zh,en);
    function setRows(next:T[]|null) { latest.current.preview=next;setPreview(next); }
    function cleanup() {
      cancelAnimationFrame(frame.current);
      carry.current=null;pending.current=null;
      document.documentElement.classList.remove('project-is-dragging');
      setPicked(null);setOver(null);
    }
    function finish() {
      const d=carry.current;if(!d)return;
      const next=latest.current.preview??d.snapshot;
      const task=next.find(item=>item.id===d.id)!;
      const index=next.filter(item=>item.status===task.status).sort(byBoardOrder).findIndex(item=>item.id===d.id);
      // Keep the carried card visible until React has committed its replacement.
      // A normal batched update may otherwise paint one empty placeholder frame.
      flushSync(()=>{
        cleanup();setRows(null);
        if(!d.cancelled)latest.current.onMove(d.id,task.status,index);
      });
      d.overlay.remove();
      suppressClick.current=false;
      say(d.cancelled?t('已放回原位','Move cancelled'):t('已移动工作项','Item moved'));
    }
    function release(cancel=false) {
      pending.current=null;const d=carry.current;if(!d||d.phase==='settle')return;
      d.phase='settle';d.cancelled=cancel;d.released=performance.now();
      d.overlay.classList.add('is-settling');
      if(cancel)setRows(d.snapshot);
      setOver(null);document.documentElement.classList.remove('project-is-dragging');
    }
    function tick(now:number) {
      const d=carry.current;if(!d)return;
      const dt=Math.min((now-d.time)/1000||1/60,1/30);d.time=now;
      let x=d.x-d.offsetX,y=d.y-d.offsetY;
      if(d.phase==='drag') {
        const bounds=el.getBoundingClientRect();
        if(el.scrollWidth>el.clientWidth) {
          const direction=d.x<bounds.left+48?-1:d.x>bounds.right-48?1:0;
          el.scrollLeft+=direction*480*dt;
        }
        const laneEls=Array.from(el.querySelectorAll<HTMLElement>('[data-project-column]'));
        const inside=d.x>=bounds.left-32&&d.x<=bounds.right+32&&d.y>=bounds.top-32&&d.y<=bounds.bottom+32;
        if(inside) {
          const lane=laneEls.sort((a,b)=>Math.abs(d.x-(a.getBoundingClientRect().left+a.clientWidth/2))-Math.abs(d.x-(b.getBoundingClientRect().left+b.clientWidth/2)))[0];
          if(lane) {
            const list=lane.querySelector<HTMLElement>('.project-column-list')!;
            const lr=list.getBoundingClientRect();
            if(list.scrollHeight>list.clientHeight) list.scrollTop+=(d.y<lr.top+35?-1:d.y>lr.bottom-35?1:0)*380*dt;
            const status=lane.dataset.projectColumn!;
            const slot=el.querySelector<HTMLElement>('[data-project-placeholder]')?.getBoundingClientRect();
            const next=latest.current.preview??d.snapshot;
            const current=next.find(item=>item.id===d.id)!;
            if(!(status===current.status&&slot&&d.y>=slot.top-8&&d.y<=slot.bottom+8)) {
              const remaining=next.filter(item=>item.status===status&&item.id!==d.id).sort(byBoardOrder);
              let index=remaining.findIndex(item=>{
                const card=el.querySelector<HTMLElement>(`[data-project-item="${CSS.escape(item.id)}"]`);
                if(!card)return false;
                return d.y<lr.top+card.offsetTop-list.scrollTop+card.offsetHeight/2;
              });
              if(index<0)index=remaining.length;
              const oldIndex=next.filter(item=>item.status===current.status).sort(byBoardOrder).findIndex(item=>item.id===d.id);
              if(status!==current.status||index!==oldIndex)setRows(moveProjectItem(next,d.id,status,index,next.map(item=>item.id)));
            }
            setOver(status);
          }
        } else setOver(null);
      } else {
        const rect=el.querySelector<HTMLElement>('[data-project-placeholder]')?.getBoundingClientRect();
        if(rect){x=rect.x;y=rect.y;}
      }
      if(latest.current.reduced)Object.assign(d.body,{x,y,angle:0,vx:0,vy:0});
      else stepDragBody(d.body,x,y,dt,d.phase==='drag');
      d.overlay.style.transform=`translate3d(${d.body.x}px,${d.body.y}px,0) rotate(${d.body.angle}deg)`;
      if(d.phase==='settle'&&(latest.current.reduced||(Math.hypot(d.body.x-x,d.body.y-y)<.4&&Math.abs(d.body.angle)<.08)||now-d.released>650)){finish();return;}
      frame.current=requestAnimationFrame(tick);
    }
    function move(event:PointerEvent) {
      const p=pending.current;
      if(p&&event.pointerId===p.pointerId&&Math.hypot(event.clientX-p.x,event.clientY-p.y)>4) {
        const node=el.querySelector<HTMLElement>(`[data-project-item="${CSS.escape(p.id)}"]`);
        if(!node){pending.current=null;return;}
        const r=node.getBoundingClientRect();const overlay=node.cloneNode(true) as HTMLElement;
        overlay.removeAttribute('data-project-item');overlay.removeAttribute('tabindex');
        overlay.querySelectorAll('[id]').forEach(child=>child.removeAttribute('id'));
        overlay.setAttribute('aria-hidden','true');overlay.inert=true;
        overlay.className='project-weight-overlay';
        Object.assign(overlay.style,{width:`${r.width}px`,height:`${r.height}px`,transform:`translate3d(${r.x}px,${r.y}px,0)`});
        document.body.append(overlay);
        carry.current={id:p.id,pointerId:p.pointerId,x:event.clientX,y:event.clientY,offsetX:p.x-r.x,offsetY:p.y-r.y,body:createDragBody(r.x,r.y),overlay,height:r.height,snapshot:latest.current.items,phase:'drag',cancelled:false,time:performance.now(),released:0};
        pending.current=null;suppressClick.current=true;
        setRows(latest.current.items);setPicked(p.id);
        document.documentElement.classList.add('project-is-dragging');
        frame.current=requestAnimationFrame(tick);
      }
      const d=carry.current;
      if(d&&d.pointerId===event.pointerId&&d.phase==='drag'){d.x=event.clientX;d.y=event.clientY;event.preventDefault();}
    }
    function up(event:PointerEvent) {
      if(carry.current?.pointerId===event.pointerId) {
        const r=el.getBoundingClientRect();
        release(event.clientX<r.left-32||event.clientX>r.right+32||event.clientY<r.top-32||event.clientY>r.bottom+32);
      }
      pending.current=null;
    }
    function cancel(){release(true);}
    function cancelKeyboard() {
      if (!keyboard.current) return;
      keyboard.current=null;setRows(null);setPicked(null);setOver(null);
      say(t('已取消移动','Move cancelled'));
    }
    function key(event:KeyboardEvent){if(event.key==='Escape'&&carry.current){event.preventDefault();release(true);}}
    function hide(){if(document.hidden&&carry.current){release(true);finish();}}
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);
    document.addEventListener('pointerdown',cancelKeyboard,true);
    document.addEventListener('keydown',key);document.addEventListener('visibilitychange',hide);
    return()=>{
      cancelAnimationFrame(frame.current);carry.current?.overlay.remove();carry.current=null;
      document.documentElement.classList.remove('project-is-dragging');
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);window.removeEventListener('resize',cancel);
      document.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hide);
      document.removeEventListener('pointerdown',cancelKeyboard,true);
    };
  },[]);

  function keyboardMove(event:React.KeyboardEvent<HTMLDivElement>,item:T) {
    if(event.target!==event.currentTarget||disabled||carry.current)return;
    if(!keyboard.current) {
      if(event.key===' '||event.key==='Enter') {event.preventDefault();keyboard.current={id:item.id,snapshot:items};setPicked(item.id);setPreview(items);say(t('已拾起，方向键移动，空格放下，Esc 取消','Picked up. Arrows move, Space drops, Escape cancels.'));}
      return;
    }
    if(event.key==='Escape') {event.preventDefault();keyboard.current=null;setPicked(null);setPreview(null);setOver(null);say(t('已取消移动','Move cancelled'));return;}
    if(event.key===' '||event.key==='Enter'||event.key==='Tab') {
      if(event.key!=='Tab')event.preventDefault();
      const current=rows.find(row=>row.id===keyboard.current!.id)!;
      const index=rows.filter(row=>row.status===current.status).sort(byBoardOrder).findIndex(row=>row.id===current.id);
      keyboard.current=null;setPicked(null);setPreview(null);setOver(null);onMove(current.id,current.status,index);return;
    }
    if(!event.key.startsWith('Arrow'))return;
    event.preventDefault();
    const current=rows.find(row=>row.id===keyboard.current!.id)!;
    let col=columns.findIndex(column=>column.id===current.status);
    let index=rows.filter(row=>row.status===current.status).sort(byBoardOrder).findIndex(row=>row.id===current.id);
    if(event.key==='ArrowRight')col=Math.min(columns.length-1,col+1);
    if(event.key==='ArrowLeft')col=Math.max(0,col-1);
    if(event.key==='ArrowDown')index++;
    if(event.key==='ArrowUp')index--;
    const next=moveProjectItem(rows,current.id,columns[col].id,index,rows.map(row=>row.id));
    setPreview(next);setOver(columns[col].id);
    requestAnimationFrame(()=>{
      const node=root.current?.querySelector<HTMLElement>(`[data-project-item="${CSS.escape(current.id)}"]`);
      node?.focus({preventScroll:true});node?.scrollIntoView({block:'nearest',inline:'nearest'});
    });
    say(t(`移到${columns[col].zh}`,`Moved to ${columns[col].en}`));
  }
  return <div ref={root} className="project-grid-scroll" onClickCapture={event=>{if(suppressClick.current){event.stopPropagation();event.preventDefault();suppressClick.current=false;}}}>
    <div className="project-grid" style={{gridTemplateColumns:`repeat(${columns.length}, minmax(220px, 1fr))`}}>
      {columns.map(column=>{
        const inColumn=rows.filter(item=>item.status===column.id).sort(byBoardOrder);
        const StatusIcon=column.id==='done'?CheckCircle2:column.id==='in_progress'?CircleDot:column.id==='waiting'||column.id==='this_week'?Clock3:Circle;
        return <section key={column.id} data-project-column={column.id} className={`project-column ${over===column.id?'is-over':''}`} aria-label={t(column.zh,column.en)}>
          <header className="project-column-heading"><StatusIcon className="h-3.5 w-3.5"/><h3>{t(column.zh,column.en)}</h3><span>{inColumn.length}</span><button type="button" disabled={disabled} onClick={()=>onAdd(column.id)} aria-label={t(`在${column.zh}添加工作项`,`Add item to ${column.en}`)}><Plus className="h-4 w-4"/></button></header>
          <div className="project-column-list" role="list">
            {inColumn.map(item=>carry.current?.id===item.id?<div key={item.id} data-project-placeholder className="project-drop-placeholder" style={{height:carry.current.height}}/>:
              <motion.div layout="position" transition={reduced?{duration:0}:{type:'spring',stiffness:380,damping:30}} key={item.id} data-project-item={item.id} className={`project-draggable ${picked===item.id?'is-picked':''}`} tabIndex={disabled?-1:0} role="listitem" aria-label={labelItem(item)} aria-roledescription={t('可拖动工作项','draggable item')}
                onKeyDown={event=>keyboardMove(event,item)}
                onPointerDown={event=>{
                  if(disabled||carry.current||keyboard.current||event.button!==0)return;
                  suppressClick.current=false;
                  const target=event.target as HTMLElement;
                  const handle=target.closest('[data-project-drag-handle]');
                  if(!handle&&(target.closest('button,input,textarea,select,a,[data-no-drag]')||event.pointerType==='touch'))return;
                  pending.current={id:item.id,x:event.clientX,y:event.clientY,pointerId:event.pointerId};
                }}>{renderItem(item)}</motion.div>)}
            {inColumn.length===0&&<p className="project-column-empty">{t('拖到这里，或添加工作项','Drop an item here, or add one')}</p>}
          </div>
        </section>;
      })}
    </div>
    <p ref={live} role="status" aria-live="polite" className="sr-only"/>
  </div>;
}
