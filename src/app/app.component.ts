import { Component, HostListener, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Clue { id:string; value:number; clue:string; response:string; hint:string; dailyDouble?:boolean }
interface Category { id:string; name:string; clues:Clue[] }
interface Final {category:string;clue:string;response:string;hint?:string}
interface Game {schemaVersion:number;title:string;categories:Category[];finalJeopardy:Final}
interface Team {id:string;name:string;classroom?:string;score:number;wager:number}
interface Session {used:string[];teams:Team[];gameKey:string}
const uid=()=>crypto.randomUUID();
const starter:Game={schemaVersion:1,title:'New Challenge',categories:Array.from({length:6},(_,i)=>({id:uid(),name:`Category ${i+1}`,clues:[100,200,300,400,500].map(value=>({id:uid(),value,clue:'',response:'',hint:''}))})),finalJeopardy:{category:'Final Challenge',clue:'',response:'',hint:''}};
@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./app.component.html'})
export class AppComponent {
  games=signal<Game[]>([]); selected=signal(0); edit=signal(false); modal=signal<Clue|null>(null); final=signal(false); revealed=signal(false); hinted=signal(false); seconds=signal(15); timerSeconds=signal(15); active=signal(false); used=signal<string[]>([]);
  teams=signal<Team[]>(Array.from({length:4},(_,i)=>({id:uid(),name:`Team ${i+1}`,score:0,wager:0})));
  pendingDeleteTeam=signal<Team|null>(null);
  managingTeams=signal(false);
  newTeamName=signal('');
  newTeamClassroom=signal('');
  teamError=signal('');
  categoryIndex=signal(0); clueIndex=signal(0); notice=signal(''); projector=signal(false); private timer:any=null; private channel?:BroadcastChannel;
  game=computed(()=>this.games()[this.selected()] ?? starter);
  boardRows=computed(()=>Array.from({length:Math.max(0,...this.game().categories.map(c=>c.clues.length))},(_,i)=>i));
  currentValue=computed(()=>this.modal()?.value ?? 0);
  displayValue=computed(()=>Math.round(this.currentValue()*(this.hinted()?0.75:1)));
  constructor(){
    const saved=localStorage.getItem('cb-games-v1');
    if(saved){try{const arr=JSON.parse(saved);if(Array.isArray(arr)&&arr.length)this.games.set(arr)}catch{}}
    const sess=localStorage.getItem('cb-session-v1');
    if(sess){try{const x=JSON.parse(sess) as Session;this.used.set(x.used||[]);this.teams.set(x.teams||[])}catch{}}
    effect(()=>{const gs=this.games();if(gs.length)localStorage.setItem('cb-games-v1',JSON.stringify(gs))});
    effect(()=>{localStorage.setItem('cb-session-v1',JSON.stringify({used:this.used(),teams:this.teams(),gameKey:this.game().title}))});
    try { this.channel=new BroadcastChannel('challenge-board'); this.channel.onmessage=e=>{if(e.data?.type==='sync'&&this.projector()){this.games.set(e.data.games);this.selected.set(e.data.selected);this.used.set(e.data.used);this.teams.set(e.data.teams);this.modal.set(e.data.modal);this.final.set(e.data.final);this.revealed.set(e.data.revealed);this.hinted.set(e.data.hinted);this.seconds.set(e.data.seconds)}} }catch{}
    effect(()=>{if(!this.projector())this.channel?.postMessage({type:'sync',games:this.games(),selected:this.selected(),used:this.used(),teams:this.teams(),modal:this.modal(),final:this.final(),revealed:this.revealed(),hinted:this.hinted(),seconds:this.seconds()})});
    if(!saved)void this.loadSamples();
  }
  async loadSamples(){try{const names=await (await fetch('games/index.json')).json() as string[];const arr=await Promise.all(names.map(async n=>await (await fetch('games/'+n)).json() as Game));if(!this.games().length)this.games.set(arr)}catch{this.games.set([structuredClone(starter)])}}
  pick(i:number){this.stop();this.selected.set(i);this.used.set([]);this.modal.set(null);this.final.set(false);this.notice.set('New board selected; used clues reset.');}
  open(clue:Clue){if(this.used().includes(clue.id))return;this.modal.set(clue);this.final.set(false);this.revealed.set(false);this.hinted.set(false);this.start(15)}
  openFinal(){this.modal.set(null);this.final.set(true);this.revealed.set(false);this.hinted.set(false);this.start(30)}
  close(mark=true){this.stop();if(mark&&this.modal())this.used.update(a=>[...a,this.modal()!.id]);this.modal.set(null);this.final.set(false)}
  reveal(){this.stop();this.revealed.set(true)}
  hint(){this.hinted.set(true)}
  start(n=this.timerSeconds()){this.stop();this.seconds.set(n);this.active.set(true);this.timer=setInterval(()=>{this.seconds.update(v=>Math.max(0,v-1));if(this.seconds()===0){this.stop();this.beep()}},1000)}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;this.active.set(false)}
  beep(){try{const c=new AudioContext();const o=c.createOscillator();const g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=700;g.gain.value=.1;o.start();o.stop(c.currentTime+.25);o.onended=()=>void c.close()}catch{}}
  score(id:string,correct:boolean){const t=this.teams().find(x=>x.id===id);if(!t)return;const value=this.final()?Math.max(0,t.wager):this.displayValue();this.teams.update(ts=>ts.map(x=>x.id===id?{...x,score:x.score+(correct?value:-value)}:x))}
  changeTeam(id:string,key:'name'|'wager',value:string|number){this.teams.update(ts=>ts.map(t=>t.id===id?{...t,[key]:key==='wager'?Number(value):value}:t))}
  addTeam(){this.teams.update(ts=>[...ts,{id:uid(),name:this.uniqueTeamName(),score:0,wager:0}])}
  uniqueTeamName(){let n=1;while(this.teams().some(t=>t.name.trim().toLowerCase()===`team ${n}`))n++;return `Team ${n}`}
  openTeamManager(){this.teamError.set('');this.newTeamName.set('');this.newTeamClassroom.set('');this.managingTeams.set(true)}
  closeTeamManager(){this.managingTeams.set(false);this.teamError.set('')}
  createTeam(){const name=this.newTeamName().trim();if(!name){this.teamError.set('Enter a team name.');return}if(this.teams().some(t=>t.name.trim().toLowerCase()===name.toLowerCase())){this.teamError.set('A team with that name already exists.');return}this.teams.update(ts=>[...ts,{id:uid(),name,classroom:this.newTeamClassroom().trim(),score:0,wager:0}]);this.newTeamName.set('');this.newTeamClassroom.set('');this.teamError.set('')}
  updateTeamName(id:string,value:string){const name=value.trim();if(!name){this.teamError.set('Team names cannot be blank.');return}if(this.teams().some(t=>t.id!==id&&t.name.trim().toLowerCase()===name.toLowerCase())){this.teamError.set('Team names must be unique.');return}this.teams.update(ts=>ts.map(t=>t.id===id?{...t,name}:t));this.teamError.set('')}
  updateTeamClassroom(id:string,value:string){this.teams.update(ts=>ts.map(t=>t.id===id?{...t,classroom:value.trim()}:t))}
  updateTeamScore(id:string,value:number|string){const score=Number(value);if(!Number.isFinite(score)||!Number.isInteger(score)){this.teamError.set('Scores must be whole numbers.');return}this.teams.update(ts=>ts.map(t=>t.id===id?{...t,score}:t));this.teamError.set('')}
  removeTeam(id:string){if(this.teams().length<=1)return;const team=this.teams().find(t=>t.id===id);if(team)this.pendingDeleteTeam.set(team)}
  cancelTeamDelete(){this.pendingDeleteTeam.set(null)}
  confirmTeamDelete(){const team=this.pendingDeleteTeam();if(!team)return;this.pendingDeleteTeam.set(null);if(this.teams().length>1)this.teams.update(ts=>ts.filter(t=>t.id!==team.id))}
  @HostListener('document:keydown.escape') onEscape(){if(this.pendingDeleteTeam())this.cancelTeamDelete();else if(this.managingTeams())this.closeTeamManager()}
  resetScores(){if(confirm('Reset all team scores?'))this.teams.update(ts=>ts.map(t=>({...t,score:0,wager:0})))}
  restoreDefaultTeams(){if(!confirm('Restore default Teams 1–4? This will replace the current team list and reset all team scores and wagers to zero. The question board will not be changed.'))return;this.pendingDeleteTeam.set(null);this.teams.set(Array.from({length:4},(_,i)=>({id:uid(),name:`Team ${i+1}`,score:0,wager:0})));this.notice.set('Default Teams 1–4 restored.')}
  resetBoard(){if(!confirm('Reset this game? This will restore all played clues and clear all team scores and wagers.'))return;this.stop();this.modal.set(null);this.final.set(false);this.revealed.set(false);this.hinted.set(false);this.seconds.set(this.timerSeconds());this.used.set([]);this.teams.update(ts=>ts.map(t=>({...t,score:0,wager:0})));this.notice.set('Board and scores reset.')}
  openBuzz(){window.open('https://buzzin.live/','_blank','noopener,noreferrer')}
  openProjector(){window.open(location.pathname+'?projector=1','_blank')}
  setupProjector(){this.projector.set(new URLSearchParams(location.search).has('projector'))}
  editGame(){this.edit.set(true);this.close(false)}
  newGame(){this.games.update(gs=>[...gs,structuredClone({...starter,title:'Untitled Challenge',categories:starter.categories.map(c=>({...c,id:uid(),clues:c.clues.map(q=>({...q,id:uid()}))}))})]);this.selected.set(this.games().length-1);this.used.set([]);this.edit.set(true)}
  copyGame(){const clone=structuredClone(this.game());clone.title+=' (Copy)';clone.categories.forEach(c=>{c.id=uid();c.clues.forEach(q=>q.id=uid())});this.games.update(gs=>[...gs,clone]);this.selected.set(this.games().length-1);this.used.set([]);this.edit.set(true)}
  deleteGame(){if(this.games().length<2)return;if(confirm('Delete this game permanently from browser storage?')){this.games.update(gs=>gs.filter((_,i)=>i!==this.selected()));this.selected.set(0);this.used.set([])}}
  updateGame(mutator:(g:Game)=>void){this.games.update(gs=>gs.map((g,i)=>{if(i!==this.selected())return g;const next=structuredClone(g);mutator(next);return next}))}
  renameGame(v:string){this.updateGame(g=>g.title=v)}
  editCategory(i:number,v:string){this.updateGame(g=>g.categories[i].name=v)}
  addCategory(){this.updateGame(g=>g.categories.push({id:uid(),name:'New Category',clues:[100,200,300,400,500].map(value=>({id:uid(),value,clue:'',response:'',hint:''}))}))}
  deleteCategory(i:number){if(confirm('Delete category and all its questions?'))this.updateGame(g=>g.categories.splice(i,1))}
  updateClue(ci:number,qi:number,field:keyof Clue,value:any){this.updateGame(g=>(g.categories[ci].clues[qi] as any)[field]=field==='value'?Number(value):value)}
  addClue(ci:number){this.updateGame(g=>g.categories[ci].clues.push({id:uid(),value:(g.categories[ci].clues.length+1)*100,clue:'',response:'',hint:''}))}
  duplicateClue(ci:number,qi:number){this.updateGame(g=>g.categories[ci].clues.splice(qi+1,0,{...structuredClone(g.categories[ci].clues[qi]),id:uid()}))}
  deleteClue(ci:number,qi:number){if(confirm('Delete this question?'))this.updateGame(g=>g.categories[ci].clues.splice(qi,1))}
  updateFinal(field:keyof Final,value:string){this.updateGame(g=>(g.finalJeopardy as any)[field]=value)}
  exportGame(){this.download(this.game().title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'.json',this.game())}
  exportResults(){this.download('challenge-results.json',{title:this.game().title,completed:new Date().toISOString(),teams:this.teams().slice().sort((a,b)=>b.score-a.score),usedClues:this.used()})}
  download(name:string,obj:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  async importFile(e:Event){const input=e.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{const val=JSON.parse(await file.text());const games:Array<Game>=Array.isArray(val)?val:[val];games.forEach(g=>this.validate(g));this.games.update(gs=>[...gs,...games]);this.selected.set(this.games().length-games.length);this.used.set([]);this.notice.set(`Imported ${games.length} game(s).`)}catch(err){alert('Import failed: '+(err instanceof Error?err.message:String(err)))}input.value=''}
  validate(g:any){if(!g||typeof g.title!=='string'||!Array.isArray(g.categories)||!g.categories.length)throw Error('Expected a game with a title and categories');for(const c of g.categories){if(typeof c.name!=='string'||!Array.isArray(c.clues))throw Error('Invalid category');for(const q of c.clues){if(typeof q.clue!=='string'||typeof q.response!=='string'||typeof q.value!=='number')throw Error('Invalid clue/response/value');q.id||=uid()}c.id||=uid()}g.schemaVersion||=1;g.finalJeopardy||={category:'Final',clue:'',response:''}}
  errors(){const found:string[]=[];this.game().categories.forEach(c=>{const vals=new Set<number>();c.clues.forEach(q=>{if(!q.clue.trim()||!q.response.trim())found.push(`${c.name}: incomplete $${q.value}`);if(vals.has(q.value))found.push(`${c.name}: duplicate $${q.value}`);vals.add(q.value)})});return found}
  constructorReady=(()=>{queueMicrotask(()=>this.setupProjector());return true})()
}
