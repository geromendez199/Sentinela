import 'server-only';

const windows=new Map<string,{start:number;used:number}>();
/** Per-process guard against accidental repeated suggestions; not a distributed quota. */
export function consumeAssistBudget(key:string,now=Date.now()) {
  const current=windows.get(key);
  if(current&&now-current.start<60_000) {
    if(current.used>=6)return false;
    current.used++;return true;
  }
  if(windows.size>=4096) {
    for(const [id,window] of windows)if(now-window.start>=60_000)windows.delete(id);
    if(windows.size>=4096)windows.delete(windows.keys().next().value??'');
  }
  windows.set(key,{start:now,used:1});return true;
}
