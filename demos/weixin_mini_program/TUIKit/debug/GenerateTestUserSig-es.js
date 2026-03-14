"use strict";const g=require("./lib-generate-test-usersig-es.min.js");let e=0,n="";const T=7*24*60*60;function o({userID:r,SDKAppID:s,SecretKey:t}){s&&(e=s),t&&(n=t);const i=new g.LibGenerateTestUserSig(e,n,T).genTestUserSig(r);return{SDKAppID:e,userSig:i}}exports.genTestUserSig=o;
//# sourceMappingURL=../../../.sourcemap/mp-weixin/TUIKit/debug/GenerateTestUserSig-es.js.map
