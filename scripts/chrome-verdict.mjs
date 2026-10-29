// Pure verdicts: a failure to measure is never a detected layout regression.
export function validChrome(value){return !!value&&!value.error&&Number.isFinite(value.chrome)&&value.chrome>=0&&Number.isInteger(value.blocks)&&value.blocks>=0;}
export function chromeDifference(receipt,value){
 if(!receipt||!Number.isFinite(receipt.top)||receipt.top<0)throw Error('missing or invalid chrome receipt');
 if(!validChrome(value))throw Error('missing or invalid chrome measurement');
 const sels=receipt.topSel,bands=sels==null?0:Array.isArray(sels)?sels.length:sels?1:0;
 return Math.abs(value.chrome-receipt.top)>2||value.blocks!==bands;
}
export function plantedBandDetected(receipt,control,planted,increase=24){
 if(!Number.isFinite(increase)||increase<=0||!validChrome(control)||!validChrome(planted))return false;
 try{return !chromeDifference(receipt,control)&&Math.abs(planted.chrome-control.chrome-increase)<=2&&planted.blocks===control.blocks+1;}catch{return false;}
}
