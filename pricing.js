(() => {
  const PLAN_LABELS={free:'Free',pro:'Pro',pro_plus:'Pro+',business:'Business'};
  let cycle='monthly';
  let pendingPlan=null;

  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const modal=qs('#checkout-modal');
  const toast=qs('#toast');

  function getPlan(){try{return localStorage.getItem('gaza3d_plan')||'free'}catch{return'free'}}
  function getSession(){try{return JSON.parse(localStorage.getItem('gaza3d_session')||'null')}catch{return null}}
  function setPlan(plan){
    try{localStorage.setItem('gaza3d_plan',plan)}catch{}
    qs('#current-plan-label').textContent=PLAN_LABELS[plan]||'Free';
    qsa('.plan-card').forEach(card=>card.classList.toggle('is-current',card.dataset.plan===plan));
    qsa('[data-action="select"],[data-action="checkout"]').forEach(btn=>{
      const same=btn.dataset.plan===plan;
      btn.textContent=same?'الخطة الحالية':btn.dataset.plan==='free'?'ابدأ مجانًا':
        btn.dataset.plan==='pro'?'اختيار Pro':'الترقية إلى Pro+';
      btn.disabled=same;
    });
  }
  function renderSession(){
    const s=getSession(), link=qs('#pricing-auth-link');
    if(!link)return;
    if(s?.email){
      const name=s.name||s.email.split('@')[0]||'الحساب';
      link.textContent=name.length>13?name.slice(0,13)+'…':name;
      link.href='./login.html?mode=account';
      link.classList.add('signed-in');
    }else{
      link.textContent='تسجيل الدخول';link.href='./login.html';link.classList.remove('signed-in');
    }
  }
  function showToast(message){
    toast.textContent=message;toast.classList.remove('hidden');
    clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.add('hidden'),2600);
  }
  function setCycle(next){
    cycle=next;
    qsa('.billing-option').forEach(b=>b.classList.toggle('active',b.dataset.cycle===cycle));
    qsa('.price').forEach(el=>el.textContent=el.dataset[cycle]);
    qsa('.billing-note[data-monthly-note]').forEach(el=>el.textContent=cycle==='yearly'?el.dataset.yearlyNote:el.dataset.monthlyNote);
  }
  function prepareCheckout(plan){
    pendingPlan=plan;
    const label=PLAN_LABELS[plan];
    if(plan==='business'){
      qs('#checkout-title').textContent='Business';qs('#checkout-price').textContent='مخصص';qs('#checkout-cycle').textContent='';
      qs('#checkout-plan-line').textContent='Business';qs('#checkout-billing-line').textContent='عقد مخصص';qs('#checkout-total').textContent='حسب الاحتياج';
    }else{
      const card=qs('.plan-card[data-plan="'+plan+'"]');
      const price=qs('.price',card)?.dataset[cycle]||'0';
      qs('#checkout-title').textContent=label;qs('#checkout-price').textContent='$'+price;
      qs('#checkout-cycle').textContent=cycle==='yearly'?'/ شهر · سنوي':'/ شهر';
      qs('#checkout-plan-line').textContent=label;qs('#checkout-billing-line').textContent=cycle==='yearly'?'سنوي':'شهري';
      qs('#checkout-total').textContent=cycle==='yearly'?'$'+(Number(price)*12):'$'+price;
    }
    const session=getSession();
    qs('#confirm-preview').textContent=session?.email?'اعتماد الخطة للتجربة':'تسجيل الدخول والمتابعة';
    qs('#modal-note').textContent=session?.email
      ?'سيتم اعتماد الخطة محليًا في النسخة الحالية فقط، بدون تحصيل مالي.'
      :'سنحفظ اختيارك ثم ننقلك إلى شاشة تسجيل الدخول.';
    modal.classList.remove('hidden');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
  }
  function closeModal(){modal.classList.add('hidden');modal.setAttribute('aria-hidden','true');document.body.style.overflow=''}

  qsa('.billing-option').forEach(btn=>btn.addEventListener('click',()=>setCycle(btn.dataset.cycle)));
  qsa('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
    const plan=btn.dataset.plan;
    if(btn.dataset.action==='select'&&plan==='free'){
      pendingPlan='free';
      const session=getSession();
      if(session?.email){setPlan('free');showToast('تم تفعيل Free على حسابك التجريبي.')}
      else location.href='./login.html?mode=signup&plan=free&cycle='+cycle;
      return;
    }
    prepareCheckout(plan);
  }));
  qs('#modal-close').addEventListener('click',closeModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.classList.contains('hidden'))closeModal()});
  qs('#confirm-preview').addEventListener('click',()=>{
    if(!pendingPlan)return;
    const session=getSession();
    if(!session?.email){
      location.href='./login.html?mode=signup&plan='+encodeURIComponent(pendingPlan)+'&cycle='+encodeURIComponent(cycle);
      return;
    }
    setPlan(pendingPlan);closeModal();showToast('تم اعتماد '+PLAN_LABELS[pendingPlan]+' محليًا للمعاينة. لا توجد عملية دفع حقيقية.');
  });

  const params=new URLSearchParams(location.search);
  if(params.get('activated')==='1')showToast('تم تسجيل الدخول وتفعيل الخطة التجريبية بنجاح.');
  setCycle(params.get('cycle')==='yearly'?'yearly':'monthly');
  setPlan(getPlan());renderSession();
})();