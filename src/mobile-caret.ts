// Measure the actual wrapped line rather than scrolling the entire textarea.
export function keepMobileCaretVisible(field: HTMLTextAreaElement) {
  const viewport = window.visualViewport;
  if (!viewport || !window.matchMedia("(max-width: 700px)").matches || document.activeElement !== field) return;
  const style = getComputedStyle(field);
  const mirror = document.createElement("div");
  for (const property of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "wordSpacing", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "boxSizing", "tabSize"] as const) {
    mirror.style[property] = style[property];
  }
  Object.assign(mirror.style, {position:"absolute", visibility:"hidden", pointerEvents:"none", top:"0", left:"0", width:`${field.getBoundingClientRect().width}px`, whiteSpace:"pre-wrap", overflowWrap:"break-word"});
  mirror.textContent = field.value.slice(0, field.selectionEnd);
  const cursor = document.createElement("span");
  cursor.textContent = "\u200b";
  mirror.append(cursor);
  document.body.append(mirror);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.75;
  const caretTop = field.getBoundingClientRect().top + cursor.offsetTop - field.scrollTop;
  mirror.remove();
  const bottom = viewport.offsetTop + viewport.height - 48;
  if (caretTop + lineHeight > bottom) {
    window.scrollBy({top:caretTop + lineHeight - bottom, behavior:"instant"});
  }
}
