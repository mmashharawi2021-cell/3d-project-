(() => {
  const PLAN_LABELS={free:'Free',pro:'Pro',pro_plus:'Pro+',business:'Business'};
  const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
  const params=new URLSearchParams(location.search);
  const requestedPlan=params.get('plan');
  const cycle=params.get('cycle')==='yearly'?'yearly':'monthly';
  const requestedMode=params.get('mode');
  const toast=qs('#auth-toast');

  function getSession(){try{return JSON.parse(localStorage.getItem('gaza3d_session')||'null')}catch{return null}}
  function setSession(session){try{localStorage.setItem('gaza3d_session',JSON.stringify(session))}catch{}}
  function clearSession(){try{localStorage.removeItem('gaza3d_session')}catch{}}
  function getPlan(){try{return localStorage.getItem('gaza3d_plan')||'free'}catch{return'free'}}
  function setPlan(plan){try{localStorage.setItem('gaza3d_plan',plan)}catch{}}
  function showToast(msg){toast.textContent=msg;toast.classList.remove('hidden');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),2400)}

  function selectView(view){
    qsa('.auth-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    qs('#login-form').classList.toggle('hidden',view!=='login');
    qs('#signup-form').classList.toggle('hidden',view!=='signup');
    if(view==='signup'){
      qs('#form-eyebrow').textContent='ابدأ مساحة عملك';
      qs('#form-title').textContent='إنشاء حساب';
      qs('#form-subtitle').textContent='أنشئ حسابًا تجريبيًا واحفظ الخطة التي اخترتها.';
    }else{
      qs('#form-eyebrow').textContent='مرحبًا بعودتك';
      qs('#form-title').textContent='تسجيل الدخول';
      qs('#form-subtitle').textContent='استخدم بريدك الإلكتروني للدخول إلى مساحة العمل.';
    }
  }
  function showSelectedPlan(){
    if(!requestedPlan||!PLAN_LABELS[requestedPlan])return;
    qs('#selected-plan-card').classList.remove('hidden');
    qs('#selected-plan-name').textContent=PLAN_LABELS[requestedPlan];
    qs('#selected-plan-cycle').textContent=requestedPlan==='free'?'بدون فوترة':(cycle==='yearly'?'فوترة سنوية':'فوترة شهرية');
  }
  function completeAuth(name,email){
    const session={name:(name||'').trim(),email:email.trim().toLowerCase(),createdAt:new Date().toISOString(),demo:true};
    setSession(session);
    if(requestedPlan&&PLAN_LABELS[requestedPlan])setPlan(requestedPlan);
    location.href='./pricing.html?activated=1&cycle='+cycle;
  }
  function renderAccount(){
    const s=getSession();if(!s?.email)return false;
    qs('#auth-form-wrap').classList.add('hidden');qs('#selected-plan-card').classList.add('hidden');qs('#account-view').classList.remove('hidden');
    const display=s.name||s.email.split('@')[0]||'الحساب';
    qs('#account-name').textContent=display;qs('#account-email').textContent=s.email;
    qs('#account-avatar').textContent=(display[0]||'U').toUpperCase();qs('#account-plan').textContent=PLAN_LABELS[getPlan()]||'Free';
    return true;
  }

  qsa('.auth-tab').forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.view)));
  qsa('.toggle-pass').forEach(b=>b.addEventListener('click',()=>{
    const input=document.getElementById(b.dataset.target);input.type=input.type==='password'?'text':'password';b.textContent=input.type==='password'?'إظهار':'إخفاء';
  }));
  qs('#login-form').addEventListener('submit',e=>{e.preventDefault();completeAuth('',qs('#login-email').value)});
  qs('#signup-form').addEventListener('submit',e=>{e.preventDefault();completeAuth(qs('#signup-name').value,qs('#signup-email').value)});
  qs('#google-preview').addEventListener('click',()=>showToast('تسجيل الدخول عبر Google جاهز كواجهة فقط وسيتم ربطه مع Firebase لاحقًا.'));
  qs('#forgot-link').addEventListener('click',()=>{qs('#forgot-modal').classList.remove('hidden');qs('#reset-email').value=qs('#login-email').value||''});
  qs('#forgot-close').addEventListener('click',()=>qs('#forgot-modal').classList.add('hidden'));
  qs('#forgot-modal').addEventListener('click',e=>{if(e.target.id==='forgot-modal')e.currentTarget.classList.add('hidden')});
  qs('#reset-preview').addEventListener('click',()=>{qs('#forgot-modal').classList.add('hidden');showToast('تمت محاكاة إرسال رابط الاستعادة. لا توجد رسالة بريد فعلية في النسخة الحالية.')});
  qs('#logout-btn').addEventListener('click',()=>{clearSession();location.href='./login.html'});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')qs('#forgot-modal').classList.add('hidden')});

  showSelectedPlan();
  if(requestedMode==='account'&&renderAccount())return;
  if(requestedMode==='signup'||requestedPlan)selectView('signup'); else selectView('login');
})();