"use strict";const s=require("../utils/common-utils.js");class r{constructor(t){this.groupAttributes={},this.groupCounters={},this.initProxy(t)}initProxy(t){Object.keys(t).forEach(i=>{s.isPrivateKey(i)||(this[i]=t[i])})}}exports.GroupModel=r;
//# sourceMappingURL=../../../../../.sourcemap/mp-weixin/TUIKit/states/chat-uikit-engine-lite/model/group.js.map
