// Offline signed transactions: no provider, RPC, wallet or live chain.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const solc=require('solc');
const root=path.resolve(__dirname,'../..');
const files=Object.fromEntries(['Counter.sol','CallFailure.sol'].map(name=>[name,fs.readFileSync(path.join(root,'ds/assets/examples',name),'utf8')]));
const settings={evmVersion:'cancun',optimizer:{enabled:false},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}};
async function verify(){
 const {Common,Mainnet,Hardfork}=await import('@ethereumjs/common');
 const {createVM,runTx}=await import('@ethereumjs/vm');
 const {createBlock}=await import('@ethereumjs/block');
 const {createFeeMarket1559Tx}=await import('@ethereumjs/tx');
 const {hexToBytes,bytesToHex,createAddressFromPrivateKey,createAccount}=await import('@ethereumjs/util');
 const {Interface}=await import('ethers');
 assert.match(solc.version(),/^0\.8\.36\+/);
 const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:Object.fromEntries(Object.entries(files).map(([k,content])=>[k,{content}])),settings})));
 assert.deepEqual(compiled.errors||[],[],'Compiler errors/warnings');
 const common=new Common({chain:Mainnet,hardfork:Hardfork.Cancun});
 const vm=await createVM({common});
 // Public synthetic keys used exclusively in this in-memory fixture.
 const keys=['20','30'].map(v=>hexToBytes('0x'+v.repeat(32))),senders=keys.map(createAddressFromPrivateKey);
 for(const sender of senders)await vm.stateManager.putAccount(sender,createAccount({nonce:0n,balance:10n**21n}));
 const block=createBlock({header:{number:1n,gasLimit:30000000n,baseFeePerGas:10n}},{common});
 const rows=[];
 async function send({to,data,gasLimit=500000n,who=0,label,nonce}){
  const before=await vm.stateManager.getAccount(senders[who]);
  const recipientBefore=(await vm.stateManager.getAccount(block.header.coinbase))?.balance||0n;
  const tx=createFeeMarket1559Tx({nonce:nonce??before.nonce,to,data,gasLimit,maxFeePerGas:20n,maxPriorityFeePerGas:3n},{common}).sign(keys[who]);
  const res=await runTx(vm,{tx,block});
  const after=await vm.stateManager.getAccount(senders[who]);
  assert.equal(after.nonce,before.nonce+1n,'Included transaction consumes nonce even on failure');
  assert.equal(before.balance-after.balance,res.totalGasSpent*13n,'Effective price: 10 base + 3 tip, not fee cap 20');
  const recipientAfter=(await vm.stateManager.getAccount(block.header.coinbase)).balance;
  assert.equal(recipientAfter-recipientBefore,res.totalGasSpent*3n,'Fee recipient receives only priority component');
  assert.equal(before.balance-after.balance-(recipientAfter-recipientBefore),res.totalGasSpent*10n,'Base component is not credited to recipient');
  assert(res.totalGasSpent<=gasLimit);
  if(label)rows.push({label,status:res.receipt.status,gasLimit:String(gasLimit),gasUsed:String(res.totalGasSpent),logs:res.receipt.logs.length,nonceDelta:1,feeWei:String(before.balance-after.balance)});
  return res;
 }
 async function deploy(file,name){
  const c=compiled.contracts[file][name],abi=new Interface(c.abi);
  const r=await send({data:'0x'+c.evm.bytecode.object});assert.equal(r.receipt.status,1);
  return {address:r.createdAddress,abi};
 }
 async function value(c,name='value'){
  await vm.stateManager.checkpoint();
  try{
  const res=await vm.evm.runCall({to:c.address,caller:senders[0],data:hexToBytes(c.abi.encodeFunctionData(name)),gasLimit:100000n});
  assert(!res.execResult.exceptionError);return c.abi.decodeFunctionResult(name,bytesToHex(res.execResult.returnValue))[0];
  }finally{await vm.stateManager.revert()}
 }
 function event(c,log){return c.abi.parseLog({topics:log[1].map(bytesToHex),data:bytesToHex(log[2])})}
 const counter=await deploy('Counter.sol','Counter');assert.equal(await value(counter),0n);
 assert.equal((await value(counter,'deployer')).toLowerCase(),senders[0].toString());
 let r=await send({to:counter.address,data:counter.abi.encodeFunctionData('inc',[0]),label:'Counter.inc(0)'});
 assert.equal(r.receipt.status,1);assert.equal(r.receipt.logs.length,0);assert.equal(await value(counter),0n);rows.at(-1).state='Counter: 0 → 0';
 r=await send({to:counter.address,data:counter.abi.encodeFunctionData('inc',[3]),who:1,label:'Counter.inc(3), other caller'});
 assert.equal(r.receipt.status,1);assert.equal(await value(counter),3n);assert.equal(r.receipt.logs.length,3);
 assert.deepEqual(r.receipt.logs.map(l=>event(counter,l).args.oldValue),[0n,1n,2n]);
 for(const log of r.receipt.logs)assert.equal(event(counter,log).args.cause.toLowerCase(),senders[1].toString());
 rows.at(-1).state='Counter: 0 → 3';
 // Prove there were partial effects before OOG, rather than merely rejecting at admission.
 let writes=0,logs=0;
 const step=s=>{if(s.opcode.name==='SSTORE')writes++;if(s.opcode.name==='LOG1')logs++};
 vm.evm.events.on('step',step);
 r=await send({to:counter.address,data:counter.abi.encodeFunctionData('inc',[1000]),gasLimit:50000n,label:'Counter.inc(1000), low gas'});
 vm.evm.events.removeListener('step',step);
 assert.equal(r.receipt.status,0);assert.equal(r.execResult.exceptionError.error,'out of gas');assert(writes>1&&logs>1);
 assert.equal(r.totalGasSpent,50000n);assert.equal(await value(counter),3n);assert.equal(r.receipt.logs.length,0);rows.at(-1).state='Counter: 3 → 3 (rollback)';
 const child=await deploy('CallFailure.sol','Child');
 for(const caught of [false,true]){
  const parent=await deploy('CallFailure.sol','Parent'),name=caught?'caught':'propagated';
  r=await send({to:parent.address,data:parent.abi.encodeFunctionData(name,[child.address.toString()]),label:'Parent.'+name+'(Child)'});
  assert.equal(r.receipt.status,caught?1:0);assert(r.totalGasSpent<500000n,'REVERT preserves unspent gas');
  assert.equal(await value(child),0n);assert.equal(await value(parent),caught?2n:0n);
  assert.equal(r.receipt.logs.length,caught?1:0);
  if(caught){assert.equal(event(parent,r.receipt.logs[0]).name,'Continued');assert.equal(event(parent,r.receipt.logs[0]).args.childSucceeded,false)}
  rows.at(-1).state=`Parent: 0 → ${caught?2:0}; Child: 0 → 0`;
 }
 const before=await vm.stateManager.getAccount(senders[0]);
 await assert.rejects(()=>send({to:counter.address,data:counter.abi.encodeFunctionData('inc',[1]),nonce:before.nonce+1n}),/nonce/i);
 const after=await vm.stateManager.getAccount(senders[0]);assert.equal(before.nonce,after.nonce);assert.equal(before.balance,after.balance);
 assert.equal(await value(counter),3n);
 return {compiler:solc.version(),evm:'Cancun',settings,rows,partialEffectsBeforeOOG:{writes,logs},invalidNonceRejectedWithoutFee:true};
}
module.exports={verify,files};
if(require.main===module)verify().then(report=>{const out='/home/ybc/notes-legacy-review-artifacts';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'contracts-test.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2))}).catch(e=>{console.error(e);process.exitCode=1});
