"use strict";class r{constructor(){this.store={}}update(t,s){this.store[t]=s}getData(t){return this.store[t]}reset(t=[]){t.length===0&&(this.store={}),this.store={...this.store,...t.reduce((s,e)=>({...s,[e]:void 0}),{})}}}exports.CustomStore=r;
//# sourceMappingURL=../../../../../../.sourcemap/mp-weixin/TUIKit/states/chat-uikit-engine-lite/TUIStore/store/custom.js.map
