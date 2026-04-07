import{i as T,b_ as re,r as i,o as U,a1 as oe,aP as ce,bN as E,a9 as de,j as e,_ as y,O as V,k as D,B as n,aS as me,at as xe,P as he,c0 as pe,aU as ue,f as fe,al as h,am as k,ac as v,V as ge,aR as ye,F as ve}from"./index-COP3WYah.js";import{P as O,a as _,b as P}from"./popover-CSSREQqa.js";import{S as R}from"./slider-CEmRF7Tt.js";import{S as z}from"./smartphone-D6WxwFTt.js";import{T as we}from"./tablet-iJUUIiSC.js";import{l as H,m as je,n as Ne,o as be,B as Se,S as Ce}from"./UnifiedIDELayout-D_k1nE_t.js";import{U as Ee,R as ke}from"./undo-2-DBRP7vi-.js";import{T as Oe}from"./type-DROzf2S5.js";import"./server-BrHQVkim.js";import"./use-reduced-motion-KvMkNVPR.js";import"./hard-drive-QQV-cG8t.js";import"./user-check-tLD1wvlA.js";import"./activity-BvchpIzx.js";import"./scroll-text-Cg6x1WXV.js";import"./chart-column-Ddfd4oy9.js";import"./video-bGX6ZMJQ.js";import"./key-B2LQGTw5.js";import"./bug-BcUamwms.js";import"./house-CQYO7W_T.js";import"./file-code-Crcpkfe7.js";import"./git-branch-CXlcTImh.js";import"./index-CU-8wlHP.js";import"./store-DFMCsdb9.js";import"./workflow-B8kftWf3.js";import"./codemirror-eOU-7E_b.js";import"./alert-BVp1ThPX.js";import"./lightbulb-CPLMhZtG.js";import"./dollar-sign-Db5tYtN7.js";import"./formatDistanceToNow-D-H9052F.js";import"./en-US-CE5jwcgH.js";import"./funnel-DxtwgXXB.js";import"./timer-BtDtoI1E.js";import"./send-BChEPHTW.js";const _e=[["line",{x1:"19",x2:"10",y1:"4",y2:"4",key:"15jd3p"}],["line",{x1:"14",x2:"5",y1:"20",y2:"20",key:"bu0au3"}],["line",{x1:"15",x2:"9",y1:"4",y2:"20",key:"uljnxc"}]],Pe=T("italic",_e);const Re=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"11",x2:"11",y1:"8",y2:"14",key:"1vmskp"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],ze=T("zoom-in",Re);const Te=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],Me=T("zoom-out",Te),$=[{name:"Mobile S",width:320,height:568,icon:z},{name:"Mobile M",width:375,height:667,icon:z},{name:"Mobile L",width:425,height:812,icon:z},{name:"Tablet",width:768,height:1024,icon:we},{name:"Laptop",width:1024,height:768,icon:U},{name:"Desktop",width:1440,height:900,icon:U}],q=["#000000","#1f2937","#374151","#6b7280","#9ca3af","#d1d5db","#ef4444","#f97316","#f59e0b","#eab308","#84cc16","#22c55e","#14b8a6","#06b6d4","#0ea5e9","#3b82f6","#6366f1","#8b5cf6","#a855f7","#d946ef","#ec4899","#f43f5e","#ffffff","transparent"];function pt({projectId:g,onCodeChange:w,className:X}){re();const p=i.useRef(null),M=i.useRef(!1),[d,Z]=i.useState(!1),[a,j]=i.useState(null),[N,G]=i.useState(null),[r,b]=i.useState({}),[u,A]=i.useState(""),[x,Q]=i.useState($[5]),[f,L]=i.useState(100),[S,Y]=i.useState(!0),[J,K]=i.useState([]),[ee,te]=i.useState([]),{data:m,isLoading:se,refetch:C}=oe({queryKey:["/api/preview/url",g],queryFn:async()=>{const t=await fetch(`/api/preview/url?projectId=${g}`,{credentials:"include"});if(!t.ok)throw new Error("Failed to get preview status");return t.json()},enabled:!!g,refetchInterval:(t,s)=>{const c=t;return c?.status==="starting"?2e3:c?.status==="running"?1e4:!1}}),I=ce({mutationFn:async()=>de("POST",`/api/preview/projects/${g}/preview/start`,{}),onSuccess:()=>{E({title:"Preview starting..."}),setTimeout(()=>C(),2e3)},onError:t=>{E({title:"Failed to start preview",description:t.message,variant:"destructive"})}});i.useEffect(()=>{m?.status==="stopped"&&!M.current&&(M.current=!0,I.mutate(void 0))},[m?.status]);const W=i.useCallback(()=>{const t=p.current;if(t?.contentWindow)try{const s=`
        (function() {
          if (window.__visualEditorInjected) return;
          window.__visualEditorInjected = true;

          let highlightOverlay = document.createElement('div');
          highlightOverlay.id = '__visual-editor-overlay';
          highlightOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;border:2px solid #8b5cf6;background:rgba(139,92,246,0.1);transition:all 0.15s ease;opacity:0;';
          document.body.appendChild(highlightOverlay);

          let selectedOverlay = document.createElement('div');
          selectedOverlay.id = '__visual-editor-selected';
          selectedOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;border:2px solid #22c55e;background:rgba(34,197,94,0.1);';
          document.body.appendChild(selectedOverlay);

          function getElementPath(el) {
            const path = [];
            while (el && el.tagName) {
              let selector = el.tagName.toLowerCase();
              if (el.id) selector += '#' + el.id;
              else if (el.className) selector += '.' + el.className.split(' ')[0];
              path.unshift(selector);
              el = el.parentElement;
            }
            return path.join(' > ');
          }

          function getElementInfo(el) {
            const rect = el.getBoundingClientRect();
            const styles = window.getComputedStyle(el);
            return {
              tagName: el.tagName,
              id: el.id || undefined,
              className: el.className || undefined,
              text: el.innerText?.substring(0, 200),
              src: el.src,
              href: el.href,
              path: getElementPath(el),
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              styles: {
                color: styles.color,
                backgroundColor: styles.backgroundColor,
                fontSize: styles.fontSize,
                fontWeight: styles.fontWeight,
                fontStyle: styles.fontStyle,
                textDecoration: styles.textDecoration,
                textAlign: styles.textAlign,
                padding: styles.padding,
                margin: styles.margin,
                borderRadius: styles.borderRadius,
                opacity: styles.opacity
              },
              canEdit: ['P','H1','H2','H3','H4','H5','H6','SPAN','A','BUTTON','DIV','SECTION','ARTICLE','HEADER','FOOTER','LABEL'].includes(el.tagName)
            };
          }

          function updateOverlay(overlay, rect, show) {
            if (show && rect) {
              overlay.style.left = rect.x + 'px';
              overlay.style.top = rect.y + 'px';
              overlay.style.width = rect.width + 'px';
              overlay.style.height = rect.height + 'px';
              overlay.style.opacity = '1';
            } else {
              overlay.style.opacity = '0';
            }
          }

          document.addEventListener('mousemove', function(e) {
            if (!window.__editModeActive) return;
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el && el !== highlightOverlay && el !== selectedOverlay) {
              const info = getElementInfo(el);
              updateOverlay(highlightOverlay, info.rect, true);
              window.parent.postMessage({ type: 'element-hover', data: info }, '*');
            }
          });

          document.addEventListener('click', function(e) {
            if (!window.__editModeActive) return;
            e.preventDefault();
            e.stopPropagation();
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el && el !== highlightOverlay && el !== selectedOverlay) {
              window.__selectedElement = el;
              const info = getElementInfo(el);
              updateOverlay(selectedOverlay, info.rect, true);
              window.parent.postMessage({ type: 'element-select', data: info }, '*');
            }
          }, true);

          document.addEventListener('mouseleave', function() {
            updateOverlay(highlightOverlay, null, false);
            window.parent.postMessage({ type: 'element-hover', data: null }, '*');
          });

          window.addEventListener('message', function(e) {
            if (e.data.type === 'set-edit-mode') {
              window.__editModeActive = e.data.active;
              if (!e.data.active) {
                updateOverlay(highlightOverlay, null, false);
                updateOverlay(selectedOverlay, null, false);
              }
            } else if (e.data.type === 'apply-styles' && window.__selectedElement) {
              Object.assign(window.__selectedElement.style, e.data.styles);
              if (e.data.text !== undefined) {
                window.__selectedElement.innerText = e.data.text;
              }
              const info = getElementInfo(window.__selectedElement);
              updateOverlay(selectedOverlay, info.rect, true);
              window.parent.postMessage({ type: 'element-updated', data: info }, '*');
            } else if (e.data.type === 'show-outlines') {
              document.querySelectorAll('*').forEach(el => {
                if (e.data.show) {
                  el.style.outline = '1px dashed rgba(139,92,246,0.3)';
                } else {
                  el.style.outline = '';
                }
              });
            }
          });

          console.log('[VisualEditor] Script injected successfully');
        })();
      `;t.contentWindow.postMessage({type:"inject-script",script:s},"*");const c=t.contentDocument;if(c){const F=c.createElement("script");F.textContent=s,c.body.appendChild(F)}}catch{}},[]);i.useEffect(()=>{const t=s=>{s.data.type==="element-hover"?G(s.data.data):s.data.type==="element-select"?(j(s.data.data),A(s.data.data?.text||""),b({})):s.data.type==="element-updated"&&j(s.data.data)};return window.addEventListener("message",t),()=>window.removeEventListener("message",t)},[]),i.useEffect(()=>{const t=p.current;t&&t.contentWindow?.postMessage({type:"set-edit-mode",active:d},"*")},[d]),i.useEffect(()=>{const t=p.current;t&&t.contentWindow?.postMessage({type:"show-outlines",show:S&&d},"*")},[S,d]);const ae=i.useCallback(()=>{setTimeout(W,500)},[W]),o=i.useCallback((t,s)=>{b(c=>({...c,[t]:s}))},[]),le=i.useCallback(()=>{if(!a)return;const t={...r},s=u!==a.text;K(c=>[...c,{element:a,styles:r,text:s?u:void 0}]),te([]),p.current?.contentWindow?.postMessage({type:"apply-styles",styles:t,text:s?u:void 0},"*"),E({title:"Changes applied",description:"Style changes applied to preview"}),w&&w(a.path,JSON.stringify({styles:t,text:s?u:void 0}))},[a,r,u,w]),ie=i.useCallback(()=>{const t=p.current;if(t&&m?.previewUrl){const s=new URL(m.previewUrl,window.location.origin);s.searchParams.set("_t",Date.now().toString()),t.src=s.toString()}C()},[m?.previewUrl,C]),B=m?.status==="running"||m?.status==="static",ne=B&&m?.previewUrl,l={color:r.color||a?.styles.color||"#000000",backgroundColor:r.backgroundColor||a?.styles.backgroundColor||"transparent",textAlign:r.textAlign||a?.styles.textAlign||"left",fontWeight:r.fontWeight||a?.styles.fontWeight||"normal",fontStyle:r.fontStyle||a?.styles.fontStyle||"normal",fontSize:r.fontSize||a?.styles.fontSize||"16px",borderRadius:r.borderRadius||a?.styles.borderRadius||"0px",opacity:r.opacity||a?.styles.opacity||"1"};return e.jsxs("div",{className:y("h-full flex flex-col bg-[var(--ecode-surface)]",X),children:[e.jsxs("div",{className:"h-9 border-b border-[var(--ecode-border)] flex items-center justify-between px-2.5 gap-2 bg-[var(--ecode-surface)]",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx(V,{className:"h-3.5 w-3.5 shrink-0 text-[var(--ecode-text-muted)]"}),e.jsx("span",{className:"text-xs font-medium text-[var(--ecode-text-muted)]",children:"Visual Editor"}),B&&e.jsx(D,{variant:"secondary",className:"text-[11px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",children:"Live"})]}),e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsxs(n,{variant:d?"default":"outline",size:"sm",onClick:()=>Z(!d),className:y("h-7 gap-1",d&&"bg-purple-600 hover:bg-purple-700"),"data-testid":"toggle-edit-mode",children:[e.jsx(H,{className:"h-3.5 w-3.5"}),e.jsx("span",{className:"text-[11px] hidden sm:inline",children:d?"Editing":"Edit"})]}),e.jsxs(O,{children:[e.jsx(_,{asChild:!0,children:e.jsxs(n,{variant:"outline",size:"sm",className:"h-7 gap-1 px-2",children:[x.icon&&e.jsx(x.icon,{className:"h-3.5 w-3.5"}),e.jsx("span",{className:"text-[11px] hidden md:inline",children:x.name})]})}),e.jsx(P,{className:"w-48 p-2",align:"end",children:e.jsx("div",{className:"space-y-1",children:$.map(t=>e.jsxs(n,{variant:x.name===t.name?"secondary":"ghost",size:"sm",className:"w-full justify-start gap-2 h-8",onClick:()=>Q(t),children:[e.jsx(t.icon,{className:"h-3.5 w-3.5"}),e.jsx("span",{className:"text-[11px]",children:t.name}),e.jsxs("span",{className:"text-[11px] text-muted-foreground ml-auto",children:[t.width,"×",t.height]})]},t.name))})})]}),e.jsxs("div",{className:"flex items-center gap-1 border rounded px-1",children:[e.jsx(n,{variant:"ghost",size:"sm",className:"h-6 w-6 p-0",onClick:()=>L(Math.max(25,f-25)),children:e.jsx(Me,{className:"h-3 w-3"})}),e.jsxs("span",{className:"text-[11px] w-10 text-center",children:[f,"%"]}),e.jsx(n,{variant:"ghost",size:"sm",className:"h-6 w-6 p-0",onClick:()=>L(Math.min(200,f+25)),children:e.jsx(ze,{className:"h-3 w-3"})})]}),e.jsx(n,{variant:"ghost",size:"sm",onClick:ie,className:"h-7 w-7 p-0",children:e.jsx(me,{className:"h-3.5 w-3.5"})})]})]}),e.jsxs("div",{className:"flex-1 flex overflow-hidden",children:[e.jsx("div",{className:"flex-1 flex items-center justify-center bg-muted/30 p-4 overflow-auto",children:se?e.jsx("div",{className:"flex items-center justify-center",children:e.jsx(xe,{className:"h-8 w-8 animate-spin text-muted-foreground"})}):ne?e.jsx("div",{className:"bg-white rounded-lg shadow-lg overflow-hidden transition-all",style:{width:x.width*(f/100),height:x.height*(f/100)},children:e.jsx("iframe",{ref:p,src:m.previewUrl||"",className:"w-full h-full border-0",style:{transform:`scale(${f/100})`,transformOrigin:"top left",width:x.width,height:x.height},title:"Visual Editor Preview",sandbox:"allow-scripts allow-same-origin allow-forms allow-modals allow-popups",onLoad:ae,"data-testid":"visual-editor-iframe"})}):e.jsxs("div",{className:"text-center p-8",children:[e.jsx(V,{className:"h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50"}),e.jsx("h3",{className:"text-[15px] font-semibold mb-2",children:"Preview not available"}),e.jsx("p",{className:"text-[13px] text-muted-foreground mb-4",children:"Start the preview to use the visual editor"}),e.jsxs(n,{onClick:()=>I.mutate(void 0),children:[e.jsx(he,{className:"h-4 w-4 mr-2"}),"Start Preview"]})]})}),d&&e.jsxs("div",{className:"w-72 border-l bg-card flex flex-col",children:[e.jsxs("div",{className:"p-3 border-b",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsx("h3",{className:"text-[13px] font-semibold",children:"Element Inspector"}),e.jsxs("div",{className:"flex items-center gap-1",children:[e.jsx(n,{variant:"ghost",size:"sm",className:"h-6 w-6 p-0",disabled:J.length===0,children:e.jsx(Ee,{className:"h-3.5 w-3.5"})}),e.jsx(n,{variant:"ghost",size:"sm",className:"h-6 w-6 p-0",disabled:ee.length===0,children:e.jsx(ke,{className:"h-3.5 w-3.5"})})]})]}),e.jsxs("div",{className:"flex items-center gap-2 text-[11px] text-muted-foreground",children:[e.jsx(pe,{checked:S,onCheckedChange:Y,className:"scale-75"}),e.jsx("span",{children:"Show element outlines"})]})]}),e.jsx(ue,{className:"flex-1",children:a?e.jsxs("div",{className:"p-3 space-y-4",children:[e.jsxs("div",{className:"p-2 bg-surface-tertiary-solid rounded-lg",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-1",children:[e.jsx(fe,{className:"h-3.5 w-3.5 text-purple-500"}),e.jsx("span",{className:"text-[11px] font-medium",children:a.tagName}),a.id&&e.jsxs(D,{variant:"outline",className:"text-[10px] h-4",children:["#",a.id]})]}),e.jsx("p",{className:"text-[10px] text-muted-foreground truncate",children:a.path})]}),a.canEdit&&a.text&&e.jsxs("div",{className:"space-y-1.5",children:[e.jsxs(h,{className:"text-[11px] flex items-center gap-1.5",children:[e.jsx(Oe,{className:"w-3 h-3"})," Text Content"]}),e.jsx(k,{value:u,onChange:t=>A(t.target.value),className:"h-8 text-[11px]","data-testid":"text-content-input"})]}),e.jsx(v,{}),e.jsxs("div",{className:"space-y-3",children:[e.jsxs(h,{className:"text-[11px] flex items-center gap-1.5",children:[e.jsx(ge,{className:"w-3 h-3"})," Colors"]}),e.jsxs("div",{className:"grid grid-cols-2 gap-2",children:[e.jsxs("div",{className:"space-y-1",children:[e.jsx(h,{className:"text-[10px] text-muted-foreground",children:"Text"}),e.jsxs(O,{children:[e.jsx(_,{asChild:!0,children:e.jsxs(n,{variant:"outline",size:"sm",className:"w-full h-8 justify-start gap-2",children:[e.jsx("div",{className:"w-4 h-4 rounded border",style:{backgroundColor:l.color}}),e.jsx("span",{className:"text-[11px] truncate",children:l.color})]})}),e.jsxs(P,{className:"w-48 p-2",children:[e.jsx("div",{className:"grid grid-cols-6 gap-1 mb-2",children:q.map(t=>e.jsx("button",{className:y("w-5 h-5 rounded border",l.color===t&&"ring-2 ring-primary"),style:{backgroundColor:t},onClick:()=>o("color",t)},t))}),e.jsx(k,{type:"color",value:l.color,onChange:t=>o("color",t.target.value),className:"w-full h-8"})]})]})]}),e.jsxs("div",{className:"space-y-1",children:[e.jsx(h,{className:"text-[10px] text-muted-foreground",children:"Background"}),e.jsxs(O,{children:[e.jsx(_,{asChild:!0,children:e.jsxs(n,{variant:"outline",size:"sm",className:"w-full h-8 justify-start gap-2",children:[e.jsx("div",{className:"w-4 h-4 rounded border",style:{backgroundColor:l.backgroundColor}}),e.jsx("span",{className:"text-[11px] truncate",children:"BG"})]})}),e.jsxs(P,{className:"w-48 p-2",children:[e.jsx("div",{className:"grid grid-cols-6 gap-1 mb-2",children:q.map(t=>e.jsx("button",{className:y("w-5 h-5 rounded border",l.backgroundColor===t&&"ring-2 ring-primary"),style:{backgroundColor:t},onClick:()=>o("backgroundColor",t)},t))}),e.jsx(k,{type:"color",value:l.backgroundColor==="transparent"?"#ffffff":l.backgroundColor,onChange:t=>o("backgroundColor",t.target.value),className:"w-full h-8"})]})]})]})]})]}),e.jsx(v,{}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(h,{className:"text-[11px]",children:"Typography"}),e.jsx("div",{className:"flex gap-1",children:[{value:"left",icon:je},{value:"center",icon:Ne},{value:"right",icon:be}].map(({value:t,icon:s})=>e.jsx(n,{variant:l.textAlign===t?"default":"outline",size:"sm",className:"h-7 flex-1",onClick:()=>o("textAlign",t),children:e.jsx(s,{className:"w-3.5 h-3.5"})},t))}),e.jsxs("div",{className:"flex gap-1",children:[e.jsx(n,{variant:l.fontWeight==="bold"||l.fontWeight==="700"?"default":"outline",size:"sm",className:"h-7 flex-1",onClick:()=>o("fontWeight",l.fontWeight==="bold"||l.fontWeight==="700"?"normal":"bold"),children:e.jsx(Se,{className:"w-3.5 h-3.5"})}),e.jsx(n,{variant:l.fontStyle==="italic"?"default":"outline",size:"sm",className:"h-7 flex-1",onClick:()=>o("fontStyle",l.fontStyle==="italic"?"normal":"italic"),children:e.jsx(Pe,{className:"w-3.5 h-3.5"})})]})]}),e.jsx(v,{}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(h,{className:"text-[11px]",children:"Font Size"}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(R,{value:[parseInt(l.fontSize)||16],onValueChange:([t])=>o("fontSize",`${t}px`),min:8,max:72,step:1,className:"flex-1"}),e.jsx("span",{className:"text-[11px] w-10 text-right",children:l.fontSize})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(h,{className:"text-[11px]",children:"Border Radius"}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(R,{value:[parseInt(l.borderRadius)||0],onValueChange:([t])=>o("borderRadius",`${t}px`),min:0,max:50,step:1,className:"flex-1"}),e.jsx("span",{className:"text-[11px] w-10 text-right",children:l.borderRadius})]})]}),e.jsxs("div",{className:"space-y-2",children:[e.jsx(h,{className:"text-[11px]",children:"Opacity"}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(R,{value:[parseFloat(l.opacity)*100||100],onValueChange:([t])=>o("opacity",String(t/100)),min:0,max:100,step:5,className:"flex-1"}),e.jsxs("span",{className:"text-[11px] w-10 text-right",children:[Math.round(parseFloat(l.opacity)*100),"%"]})]})]}),e.jsx(v,{}),e.jsxs("div",{className:"flex gap-2",children:[e.jsxs(n,{variant:"outline",size:"sm",className:"flex-1",onClick:()=>{j(null),b({})},children:[e.jsx(ye,{className:"h-3.5 w-3.5 mr-1"}),"Cancel"]}),e.jsxs(n,{size:"sm",className:"flex-1",onClick:le,children:[e.jsx(Ce,{className:"h-3.5 w-3.5 mr-1"}),"Apply"]})]})]}):e.jsxs("div",{className:"p-8 text-center text-muted-foreground",children:[e.jsx(H,{className:"h-12 w-12 mx-auto mb-4 opacity-50"}),e.jsx("p",{className:"text-[13px] font-medium mb-1",children:"Click an element to edit"}),e.jsx("p",{className:"text-[11px]",children:"Select any element in the preview to modify its styles"})]})}),N&&!a&&e.jsx("div",{className:"p-2 border-t bg-muted/30",children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(ve,{className:"h-3.5 w-3.5 text-muted-foreground"}),e.jsxs("span",{className:"text-[11px] text-muted-foreground truncate",children:[N.tagName," - ",N.path]})]})})]})]})]})}export{pt as VisualEditorPanel};
