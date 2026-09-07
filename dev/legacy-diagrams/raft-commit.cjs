// Executable rule examples: fixed membership, no Byzantine faults or compaction.
// Not a complete Raft implementation: no RPC transport, election timers or disk.
function integer(n,min=0){if(!Number.isSafeInteger(n)||n<min)throw Error('Invalid integer');return n}
function validateLog(log,currentTerm=Number.MAX_SAFE_INTEGER){
 if(!Array.isArray(log)||log.length>100)throw Error('Invalid log');let previous=0;
 for(const e of log){if(!e||integer(e.term,1)<previous||e.term>currentTerm||typeof e.command!=='string')throw Error('Invalid entry');previous=e.term}return log;
}
function advance({term,log,leader,matches,commitIndex}){
 integer(term,1);validateLog(log,term);integer(commitIndex);if(commitIndex>log.length)throw Error('Commit beyond log');
 if(!matches||typeof matches!=='object'||Array.isArray(matches))throw Error('Named match indexes required');
 const ids=Object.keys(matches);if(!ids.length||ids.length>9||!Object.hasOwn(matches,leader))throw Error('Invalid membership');
 for(const value of Object.values(matches))if(integer(value)>log.length)throw Error('Match beyond leader log');
 if(matches[leader]!==log.length)throw Error('Include the leader own log');
 const quorum=Math.floor(ids.length/2)+1;
 const candidates=log.map((e,i)=>({index:i+1,term:e.term,copies:ids.filter(id=>matches[id]>=i+1).length,current:e.term===term}));
 let next=commitIndex;for(const r of candidates)if(r.index>next&&r.current&&r.copies>=quorum)next=r.index;
 return {quorum,candidates,commitIndex:next,newlyCommitted:Array.from({length:next-commitIndex},(_,i)=>commitIndex+i+1)};
}
function upToDate(candidate,voter){
 validateLog(candidate);validateLog(voter);const c=candidate.at(-1)?.term||0,v=voter.at(-1)?.term||0;
 return c>v||(c===v&&candidate.length>=voter.length);
}
function append(state,rpc){
 integer(state.term);validateLog(state.log,state.term);integer(state.commitIndex);if(state.commitIndex>state.log.length)throw Error('Invalid follower commit');
 integer(rpc.term,1);integer(rpc.prevIndex);integer(rpc.prevTerm);integer(rpc.leaderCommit);validateLog(rpc.entries,rpc.term);
 if((rpc.prevIndex===0)!==(rpc.prevTerm===0))throw Error('Invalid predecessor sentinel');
 if(rpc.entries.length&&rpc.entries[0].term<rpc.prevTerm)throw Error('Terms decrease across RPC boundary');
 const next=structuredClone(state),fail=()=>({state:next,success:false,matched:null});
 if(rpc.term<state.term)return fail();next.term=rpc.term;
 if(rpc.prevIndex>next.log.length||(rpc.prevIndex>0&&next.log[rpc.prevIndex-1].term!==rpc.prevTerm))return fail();
 for(const [i,e]of rpc.entries.entries()){
  const index=rpc.prevIndex+i,existing=next.log[index];
  if(existing&&existing.term!==e.term){if(index+1<=next.commitIndex)throw Error('Attempt to overwrite committed prefix');next.log=next.log.slice(0,index)}
  if(!next.log[index])next.log.push(structuredClone(e));
  else if(next.log[index].command!==e.command)throw Error('Same index/term with different commands violates valid-leader assumptions');
 }
 const matched=rpc.prevIndex+rpc.entries.length;
 next.commitIndex=Math.max(next.commitIndex,Math.min(rpc.leaderCommit,matched));
 return {state:next,success:true,matched};
}
const entry=t=>({term:t,command:t===1?'base':t===2?'x := 3':t===3?'x := 9':'no-op'});
function scenario(){
 const logs=[[1,2],[1,2],[1],[1],[1,3]].map(xs=>xs.map(entry));
 // Before (c): S1 has been elected in term 4; S5 is unavailable. Prefix 1 is
 // already committed. The initial logs reflect the preceding term-2/3 history.
 const leader=[...logs[0],entry(4)];
 function replicate(log,entries,prevIndex,prevTerm,term,leaderCommit=1){const r=append({term:Math.max(1,log.at(-1)?.term||0),log,commitIndex:1},{term,prevIndex,prevTerm,entries,leaderCommit});if(!r.success)throw Error('Unexpected fixture rejection');return r.state.log}
 logs[0]=leader;logs[2]=replicate(logs[2],[entry(2)],1,1,4);
 const c={id:'old-majority',title:'Termine 4: voce 2 su tre server',leader:'S1',term:4,logs:structuredClone(logs),matches:{S1:3,S2:2,S3:2,S4:1,S5:0},commitIndex:1};c.result=advance({...c,log:c.logs[0]});
 const eligibleC=logs.map((log,i)=>upToDate(logs[4],log)?'S'+(i+1):null).filter(Boolean);
 // Alternative (d): S1 fails; S5's term-3 tail passes the freshness filter
 // at S2/S3/S4 and itself, permitting an election in term 5 under the other rules.
 const overwritten=structuredClone(logs);for(const i of [1,2,3])overwritten[i]=replicate(overwritten[i],[entry(3)],1,1,5);
 // Alternative (e), starting again from (c): term-4 no-op reaches S2 and S3.
 const extended=structuredClone(logs);for(const i of [1,2])extended[i]=replicate(extended[i],[entry(4)],2,2,4);
 const e={id:'current-majority',title:'Termine 4: anche la voce 3 su tre server',leader:'S1',term:4,logs:extended,matches:{S1:3,S2:3,S3:3,S4:1,S5:0},commitIndex:1};e.result=advance({...e,log:e.logs[0]});
 return {states:[c,e],overwrite:{logs:overwritten,eligibleByLogBefore:eligibleC},eligibleByLogAfter:extended.map((log,i)=>upToDate(extended[4],log)?'S'+(i+1):null).filter(Boolean)};
}
module.exports={advance,append,upToDate,scenario};
