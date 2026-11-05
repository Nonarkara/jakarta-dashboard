// Pure verdicts: a failure to measure is never a detected layout regression.
export function validChrome(value){return !!value&&!value.error&&Number.isFinite(value.chrome)&&value.chrome>=0&&Number.isInteger(value.blocks)&&value.blocks>=0;}
export function chromeDifference(receipt,value){
 if(!receipt||!Number.isFinite(receipt.top)||receipt.top<0)throw Error('missing or invalid chrome receipt');
 if(!validChrome(value))throw Error('missing or invalid chrome measurement');
 const sels=receipt.topSel,bands=sels==null?0:Array.isArray(sels)?sels.length:sels?1:0;
 // A band that clips its own content is a failure the receipt cannot hold:
 // the receipt records how tall the chrome is and how many blocks stand in
 // it, and says nothing about whether the things inside it are visible. A
 // masthead can be the right height, one band, and still eat its own
 // navigation. So the comparison carries a third question — does the band's
 // content fit inside it?
 const clipping=Array.isArray(value.clipped)&&value.clipped.length>0;
 return Math.abs(value.chrome-receipt.top)>2||value.blocks!==bands||clipping;
}
export function plantedBandDetected(receipt,control,planted,increase=24){
 if(!Number.isFinite(increase)||increase<=0||!validChrome(control)||!validChrome(planted))return false;
 try{return !chromeDifference(receipt,control)&&Math.abs(planted.chrome-control.chrome-increase)<=2&&planted.blocks===control.blocks+1;}catch{return false;}
}
