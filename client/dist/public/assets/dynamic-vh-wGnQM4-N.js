function t(){const e=()=>{const n=window.innerHeight*.01;document.documentElement.style.setProperty("--vh",`${n}px`)};return e(),window.addEventListener("resize",e),window.addEventListener("orientationchange",e),()=>{window.removeEventListener("resize",e),window.removeEventListener("orientationchange",e)}}export{t as setupDynamicVH};
//# sourceMappingURL=dynamic-vh-wGnQM4-N.js.map
