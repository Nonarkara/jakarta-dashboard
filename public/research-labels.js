// Place diagram labels without moving any measured/modelled point.
// Rectangles use canvas pixels; a missing slot omits only the text, never its marker.
export function labelPosition(x, y, width, height, bounds, occupied) {
  for (const [dx, dy] of [[12,-height-8],[12,8],[-width-12,-height-8],[-width-12,8],[12,-2*height-16],[12,height+16],[-width/2,-3*height-24],[-width/2,2*height+24]]) {
    const box={x:x+dx,y:y+dy,width,height};
    if(box.x<4||box.y<4||box.x+width>bounds.width-4||box.y+height>bounds.height-4) continue;
    if(occupied.some(b=>box.x<b.x+b.width+6&&box.x+width+6>b.x&&box.y<b.y+b.height+6&&box.y+height+6>b.y)) continue;
    return box;
  }
  return null;
}
