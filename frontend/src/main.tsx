import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft,ArrowRight,BarChart3,Check,Clock,Coffee,Download,Eye,Minus,MoreHorizontal,Package,Plus,RefreshCw,Save,ShieldCheck,ShoppingBag,Trash2,Wallet,X} from 'lucide-react';
import './style.css';
import './enhancements.css';

type Variant={id:string,name:string,price:number,volumeMl?:number};
type Product={id:string,name:string,category:string,icon?:string,quick:boolean,variants:Variant[]};
type Shift={id:string,businessDate:string,openedAt:string,openingCash:number,expectedClosingCash:number,status:string};
type Me={firstName:string,lastName?:string,username?:string,role:string};
type Order={id:string,number:number,totalAmount:number,createdAt:string,status:string,payments:{method:string,amount:number}[],items:{name:string,variant:string,quantity:number,unitPrice:number,totalPrice:number}[]};
type Dashboard={me?:Me,currentShift:Shift|null,revenue:number,ordersCount:number,cash:number,card:number,averageCheck:number,recentOrders:Order[]};
type AnalyticsPeriod='today'|'week'|'month';
type AnalyticsPosition={name:string,quantity:number};
type Analytics={period:AnalyticsPeriod,periodDays:number,revenue:number,ordersCount:number,averageCheck:number,cash:number,card:number,cups:number,coffeePortions:number,grinderPortions:number,decafCoffees:number,positions:AnalyticsPosition[],daily:{date:string,revenue:number,ordersCount:number}[]};
type ModifierName='Сироп'|'Растительное молоко'|'Без кофеина';
type CartLine={product:Product,variant:Variant,quantity:number,modifiers:ModifierName[]};
type Tab='home'|'order'|'orders'|'analytics'|'more'|'settings';
type AdminVariant=Variant&{active:boolean};
type AdminProduct={id:string,name:string,category:string,icon?:string,quick:boolean,active:boolean,variants:AdminVariant[]};
type AdminCatalog={products:AdminProduct[],categories:{name:string,icon?:string}[],activeCount:number,hiddenCount:number};
type ProductDraft={name:string,category:string,icon:string,variantName:string,price:string,volumeMl:string,quick:boolean,active:boolean,variantId?:string};
type HistorySummary={date:string,shifts:number,openShifts:number,orders:number,revenue:number,writeOffs:number};

const api=async<T,>(path:string,options:RequestInit={}):Promise<T>=>{
 const tg=(window as any).Telegram?.WebApp;
 const isForm=options.body instanceof FormData;
 const response=await fetch(path,{...options,headers:{...(isForm?{}:{'Content-Type':'application/json'}),'X-Telegram-Init-Data':tg?.initData||'',...(options.headers||{})}});
 if(!response.ok){const body=await response.json().catch(()=>null);const details=body?.message||body?.detail||Object.values(body?.errors||{}).flat().join(' ');throw new Error(details||`Ошибка сервера (${response.status})`)}
 return response.json();
};

const money=(value=0)=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:2}).format(value);
const dateTime=(value:string)=>new Date(value).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const modifierPrices:Record<ModifierName,number>={'Сироп':15,'Растительное молоко':45,'Без кофеина':15};
const modifiers:Array<{name:ModifierName,label:string}>=[{name:'Сироп',label:'Сироп +15'},{name:'Растительное молоко',label:'Растительное молоко +45'},{name:'Без кофеина',label:'Без кофеина +15'}];
const localDate=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`};
const amount=(value=0)=>new Intl.NumberFormat('uk-UA',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const reportDateLabel=(date:string)=>new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'});
const reportFileName=(date:string)=>`Отчет-${reportDateLabel(date).replace(/\s*г\.?$/,'').replace(/ /g,'-')}.pdf`;
const months=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const emptyProduct:ProductDraft={name:'',category:'Кофе',icon:'☕',variantName:'Стандарт',price:'',volumeMl:'',quick:false,active:true};
const draftFromProduct=(product:AdminProduct):ProductDraft=>{const variant=product.variants[0];return{name:product.name,category:product.category,icon:product.icon||'☕',variantName:variant?.name||'Стандарт',price:String(variant?.price??0),volumeMl:variant?.volumeMl?String(variant.volumeMl):'',quick:product.quick,active:product.active,variantId:variant?.id}};

const createDailyPdf=async(report:Analytics,date:string)=>{
 const [{default:pdfMake},{default:pdfFonts}]=await Promise.all([import('pdfmake/build/pdfmake'),import('pdfmake/build/vfs_fonts')]);
 (pdfMake as any).vfs=(pdfFonts as any).vfs;
 const rows=report.positions.length?report.positions.map((position,index)=>[{text:String(index+1),alignment:'center'},{text:position.name},{text:String(position.quantity),alignment:'center',bold:true}]):[[{text:'Продаж за этот день нет',colSpan:3,alignment:'center',color:'#978b82'}, {}, {}]];
 const definition:any={pageSize:'A4',pageMargins:[42,44,42,44],defaultStyle:{font:'Roboto',fontSize:10,color:'#29211d'},content:[{columns:[{stack:[{text:'COFFEE CONTROL',fontSize:10,bold:true,color:'#8a6044',characterSpacing:1.5},{text:'Дневной отчёт',fontSize:24,bold:true,margin:[0,5,0,3]},{text:reportDateLabel(date),color:'#756a63'}]},{text:'DAY REPORT',fontSize:9,bold:true,alignment:'right',color:'#8a6044',characterSpacing:1.2}],margin:[0,0,0,24]},{table:{widths:['*','*','*','*'],body:[[{text:'Чашки',style:'metricLabel'},{text:'Порции кофе',style:'metricLabel'},{text:'Гриндер',style:'metricLabel'},{text:'Без кофеина',style:'metricLabel'}],[{text:String(report.cups),style:'metricValue'},{text:String(report.coffeePortions),style:'metricValue'},{text:String(report.grinderPortions),style:'metricValue'},{text:String(report.decafCoffees),style:'metricValue'}]]},layout:{fillColor:(row:number)=>row===0?'#f1e8e1':'#fbf8f5',hLineColor:()=> '#e2d6cd',vLineColor:()=> '#e2d6cd',paddingTop:()=>10,paddingBottom:()=>10,paddingLeft:()=>8,paddingRight:()=>8},margin:[0,0,0,24]},{text:'Купленные позиции',fontSize:16,bold:true,margin:[0,0,0,10]},{table:{headerRows:1,widths:[28,'*',58],body:[[{text:'№',style:'tableHeader',alignment:'center'},{text:'Позиция',style:'tableHeader'},{text:'Кол-во',style:'tableHeader',alignment:'center'}],...rows]},layout:{fillColor:(row:number)=>row===0?'#6f4e37':row%2===0?'#faf6f2':null,hLineColor:()=> '#e8ded6',vLineColor:()=> '#e8ded6',paddingTop:()=>8,paddingBottom:()=>8,paddingLeft:()=>8,paddingRight:()=>8},margin:[0,0,0,22]},{text:'Оплата',fontSize:16,bold:true,margin:[0,0,0,10]},{table:{widths:['*','*','*'],body:[[{text:'Наличные',style:'metricLabel'},{text:'Карта',style:'metricLabel'},{text:'Выручка',style:'metricLabel'}],[{text:amount(report.cash),style:'paymentValue'},{text:amount(report.card),style:'paymentValue'},{text:amount(report.revenue),style:'paymentValue'}]]},layout:{fillColor:(row:number)=>row===0?'#f1e8e1':'#fbf8f5',hLineColor:()=> '#e2d6cd',vLineColor:()=> '#e2d6cd',paddingTop:()=>9,paddingBottom:()=>9,paddingLeft:()=>8,paddingRight:()=>8},margin:[0,0,0,16]},{text:`Заказов: ${report.ordersCount}`,color:'#756a63'}],footer:(currentPage:number,pageCount:number)=>({columns:[{text:'Coffee Control',color:'#a1948b'},{text:`${currentPage} / ${pageCount}`,alignment:'right',color:'#a1948b'}],fontSize:8,margin:[42,0,42,20]}),styles:{metricLabel:{fontSize:8,bold:true,color:'#756a63',alignment:'center'},metricValue:{fontSize:20,bold:true,color:'#6f4e37',alignment:'center'},paymentValue:{fontSize:14,bold:true,color:'#6f4e37',alignment:'center'},tableHeader:{bold:true,color:'#ffffff'}}};
 return {pdfMake,definition};
};

function App(){
 const [dashboard,setDashboard]=useState<Dashboard|null>(null);
 const [products,setProducts]=useState<Product[]>([]);
 const [orders,setOrders]=useState<Order[]>([]);
 const [analytics,setAnalytics]=useState<Analytics|null>(null);
 const [analyticsPeriod,setAnalyticsPeriod]=useState<AnalyticsPeriod>('week');
 const [tab,setTab]=useState<Tab>('home');
 const [category,setCategory]=useState('Все');
 const [openingCash,setOpeningCash]=useState('');
 const [actualCash,setActualCash]=useState('');
 const [closeComment,setCloseComment]=useState('');
 const [cart,setCart]=useState<CartLine[]>([]);
 const [payment,setPayment]=useState<'Cash'|'Card'|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [toast,setToast]=useState('');
 const [reportDate,setReportDate]=useState(localDate);
 const [reportBusy,setReportBusy]=useState(false);
 const [reportPreview,setReportPreview]=useState<Analytics|null>(null);
 const [adminCatalog,setAdminCatalog]=useState<AdminCatalog|null>(null);
 const [editingProduct,setEditingProduct]=useState<string|null>(null);
 const [productDraft,setProductDraft]=useState<ProductDraft>(emptyProduct);
 const [newProduct,setNewProduct]=useState<ProductDraft>(emptyProduct);
 const [historyDate,setHistoryDate]=useState(localDate);
 const [historySummary,setHistorySummary]=useState<HistorySummary|null>(null);
 const [deleteConfirmation,setDeleteConfirmation]=useState('');
 const [adminBusy,setAdminBusy]=useState(false);

 const refresh=useCallback(async(period:AnalyticsPeriod)=>{
  const [dash,orderList,report]=await Promise.all([api<Dashboard>('/api/dashboard'),api<Order[]>('/api/orders'),api<Analytics>(`/api/analytics?period=${period}`)]);
  setDashboard(dash);setOrders(orderList);setAnalytics(report);
 },[]);
 const selectAnalyticsPeriod=async(period:AnalyticsPeriod)=>{setAnalyticsPeriod(period);try{setAnalytics(await api<Analytics>(`/api/analytics?period=${period}`))}catch(error:any){setToast(error.message)}};
 const loadDailyReport=()=>api<Analytics>(`/api/analytics?period=today&date=${reportDate}`);
 const previewDailyReport=async()=>{setReportBusy(true);try{setReportPreview(await loadDailyReport())}catch(error:any){setToast(error.message)}finally{setReportBusy(false)}};
 const downloadDailyPdf=async()=>{setReportBusy(true);try{const report=await loadDailyReport();const {pdfMake,definition}=await createDailyPdf(report,reportDate);const pdfBase64=await pdfMake.createPdf(definition).getBase64();await api('/api/reports/daily/send',{method:'POST',body:JSON.stringify({date:reportDate,pdfBase64})});setReportPreview(null);setToast(`PDF «${reportFileName(reportDate)}» отправлен в чат с ботом`)}catch(error:any){setToast(error.message||'Не удалось отправить PDF')}finally{setReportBusy(false)}};
 const setReportDatePart=(part:'day'|'month'|'year',value:number)=>{let [year,month,day]=reportDate.split('-').map(Number);if(part==='day')day=value;if(part==='month')month=value;if(part==='year')year=value;day=Math.min(day,new Date(year,month,0).getDate());const next=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;setReportDate(next>localDate()?localDate():next)};
 const setDatePart=(date:string,setDate:(value:string)=>void,part:'day'|'month'|'year',value:number)=>{let [year,month,day]=date.split('-').map(Number);if(part==='day')day=value;if(part==='month')month=value;if(part==='year')year=value;day=Math.min(day,new Date(year,month,0).getDate());const next=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;setDate(next>localDate()?localDate():next)};
 const loadAdminCatalog=async()=>setAdminCatalog(await api<AdminCatalog>('/api/admin/catalog'));
 const openSettings=async()=>{setTab('settings');setAdminBusy(true);try{await loadAdminCatalog()}catch(error:any){setToast(error.message);setTab('more')}finally{setAdminBusy(false)}};
 const productPayload=(draft:ProductDraft)=>({name:draft.name,category:draft.category,icon:draft.icon,variantName:draft.variantName,price:Number(draft.price.replace(',','.')),volumeMl:draft.volumeMl?Number(draft.volumeMl):null,quick:draft.quick,active:draft.active,variantId:draft.variantId||null});
 const saveProduct=async(id?:string)=>{const draft=id?productDraft:newProduct;const price=Number(draft.price.replace(',','.'));if(!draft.name.trim()||!draft.category.trim()||!draft.variantName.trim()||!Number.isFinite(price)||price<0){setToast('Заполните название, категорию, вариант и цену');return}setAdminBusy(true);try{await api(id?`/api/admin/products/${id}`:'/api/admin/products',{method:id?'PUT':'POST',body:JSON.stringify(productPayload(draft))});await Promise.all([loadAdminCatalog(),api<Product[]>('/api/products').then(setProducts)]);setEditingProduct(null);if(!id)setNewProduct(emptyProduct);setToast(id?'Позиция обновлена':'Позиция добавлена')}catch(error:any){setToast(error.message)}finally{setAdminBusy(false)}};
 const hideProduct=async(product:AdminProduct)=>{if(!window.confirm(`Убрать «${product.name}» из продажи? Старые заказы останутся в истории.`))return;setAdminBusy(true);try{await api(`/api/admin/products/${product.id}`,{method:'DELETE'});await Promise.all([loadAdminCatalog(),api<Product[]>('/api/products').then(setProducts)]);setToast('Позиция скрыта из продажи')}catch(error:any){setToast(error.message)}finally{setAdminBusy(false)}};
 const restoreProduct=async(product:AdminProduct)=>{const draft={...draftFromProduct(product),active:true};setAdminBusy(true);try{await api(`/api/admin/products/${product.id}`,{method:'PUT',body:JSON.stringify(productPayload(draft))});await Promise.all([loadAdminCatalog(),api<Product[]>('/api/products').then(setProducts)]);setToast('Позиция возвращена в продажу')}catch(error:any){setToast(error.message)}finally{setAdminBusy(false)}};
 const previewHistoryDelete=async()=>{setAdminBusy(true);try{setHistorySummary(await api<HistorySummary>(`/api/admin/history/${historyDate}`));setDeleteConfirmation('')}catch(error:any){setToast(error.message)}finally{setAdminBusy(false)}};
 const deleteHistory=async()=>{if(deleteConfirmation!==historyDate){setToast('Введите выбранную дату для подтверждения');return}if(!window.confirm(`Безвозвратно удалить всю историю за ${reportDateLabel(historyDate)}?`))return;setAdminBusy(true);try{await api(`/api/admin/history/${historyDate}/delete`,{method:'POST',body:JSON.stringify({confirmation:deleteConfirmation})});setHistorySummary(null);setDeleteConfirmation('');await refresh(analyticsPeriod);setToast('История выбранного дня удалена')}catch(error:any){setToast(error.message)}finally{setAdminBusy(false)}};

 useEffect(()=>{
  (window as any).Telegram?.WebApp?.ready();(window as any).Telegram?.WebApp?.expand?.();
  Promise.all([refresh('week'),api<Product[]>('/api/products').then(setProducts)]).catch(error=>setToast(error.message)).finally(()=>setLoading(false));
 },[refresh]);

 useEffect(()=>{if(dashboard?.currentShift&&!actualCash)setActualCash(String(dashboard.currentShift.expectedClosingCash||0))},[dashboard,actualCash]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer)},[toast]);
 useEffect(()=>{const backButton=(window as any).Telegram?.WebApp?.BackButton;if(!reportPreview||!backButton)return;const close=()=>setReportPreview(null);backButton.show();backButton.onClick(close);return()=>{backButton.offClick(close);backButton.hide()}},[reportPreview]);

 const categories=useMemo(()=>['Все',...Array.from(new Set(products.map(product=>product.category)))],[products]);
 const visibleProducts=products.filter(product=>product.variants.length>0&&(category==='Все'||product.category===category));
 const lineTotal=(line:CartLine)=>line.quantity*(line.variant.price+line.modifiers.reduce((sum,name)=>sum+modifierPrices[name],0));
 const total=cart.reduce((sum,line)=>sum+lineTotal(line),0);
 const maxChart=Math.max(1,...(analytics?.daily.map(day=>day.revenue)||[1]));
 const [reportYear,reportMonth,reportDay]=reportDate.split('-').map(Number);
 const reportDays=Array.from({length:new Date(reportYear,reportMonth,0).getDate()},(_,index)=>index+1);
 const reportYears=Array.from({length:Math.max(3,new Date().getFullYear()-2024+1)},(_,index)=>new Date().getFullYear()-index);
 const [historyYear,historyMonth,historyDay]=historyDate.split('-').map(Number);
 const historyDays=Array.from({length:new Date(historyYear,historyMonth,0).getDate()},(_,index)=>index+1);

 const add=(product:Product,variant=product.variants[0])=>{
  if(!variant)return;
  setCart(current=>{const found=current.find(line=>line.variant.id===variant.id&&line.modifiers.length===0);return found?current.map(line=>line.variant.id===variant.id&&line.modifiers.length===0?{...line,quantity:line.quantity+1}:line):[...current,{product,variant,quantity:1,modifiers:[]}]});
  setToast(`${product.name} добавлен`);
 };
 const changeQuantity=(variantId:string,delta:number)=>setCart(current=>current.map(line=>line.variant.id===variantId?{...line,quantity:line.quantity+delta}:line).filter(line=>line.quantity>0));
 const toggleModifier=(variantId:string,name:ModifierName)=>setCart(current=>current.map(line=>line.variant.id!==variantId?line:line.modifiers.includes(name)?{...line,modifiers:line.modifiers.filter(item=>item!==name)}:{...line,modifiers:[...line.modifiers,name]}));

 const openShift=async()=>{
  const value=Number(openingCash.replace(',','.'));if(!Number.isFinite(value)||value<0){setToast('Введите корректную сумму в кассе');return}
  setBusy(true);try{await api('/api/shifts/open',{method:'POST',body:JSON.stringify({openingCash:value})});await refresh(analyticsPeriod);setOpeningCash('');setToast('Смена открыта')}catch(error:any){setToast(error.message)}finally{setBusy(false)}
 };
 const checkout=async()=>{
  if(!payment||!dashboard?.currentShift||cart.length===0||total<=0)return;
  setBusy(true);try{
   await api('/api/orders',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),items:cart.map(line=>({variantId:line.variant.id,quantity:line.quantity,modifierAmount:line.modifiers.reduce((sum,name)=>sum+modifierPrices[name],0),modifiers:line.modifiers.map(name=>({name}))})),payments:[{method:payment,amount:total}]})});
   setCart([]);setPayment(null);await refresh(analyticsPeriod);setTab('home');setToast('Заказ успешно создан');
  }catch(error:any){setToast(error.message)}finally{setBusy(false)}
 };
 const closeShift=async()=>{
  if(!dashboard?.currentShift)return;const value=Number(actualCash.replace(',','.'));if(!Number.isFinite(value)||value<0){setToast('Введите фактическую сумму в кассе');return}
  setBusy(true);try{await api(`/api/shifts/${dashboard.currentShift.id}/close`,{method:'POST',body:JSON.stringify({actualCash:value,comment:closeComment||null})});setCart([]);setPayment(null);setActualCash('');setCloseComment('');await refresh(analyticsPeriod);setTab('home');setToast('Смена закрыта')}catch(error:any){setToast(error.message)}finally{setBusy(false)}
 };

 if(loading)return <div className="loading"><Coffee/><span>Загружаем кофейню…</span></div>;
 return <div className="app">
  <header><div className="brand"><div className="logo"><Coffee size={22}/></div><div><strong>Coffee Control</strong><small>{dashboard?.currentShift?'Смена открыта':'Рабочая касса'}</small></div></div><button className="avatar" onClick={()=>setTab('more')}>{dashboard?.me?.firstName?.[0]||'Б'}</button></header>
  {toast&&<div className="toast" onClick={()=>setToast('')}>{toast}</div>}

  {tab==='home'&&<main>
   <div className="greeting">Добрый день 👋<h1>{dashboard?.currentShift?'Смена в работе':'Готовы открыть кофейню?'}</h1></div>
   {!dashboard?.currentShift?<section className="open-card"><Clock size={32}/><h2>Смена ещё не открыта</h2><p>Укажите наличные в кассе, чтобы начать работу.</p><input inputMode="decimal" placeholder="Наличные на начало, ₴" value={openingCash} onChange={event=>setOpeningCash(event.target.value)}/><button className="primary" onClick={openShift} disabled={busy}>{busy?'Открываем…':'Открыть смену'} <ArrowRight size={18}/></button></section>:<>
    <div className="hero"><span>Выручка смены</span><b>{money(dashboard.revenue)}</b><small>{dashboard.ordersCount||0} заказов · с {dateTime(dashboard.currentShift.openedAt)}</small></div>
    <div className="stats"><div><span>Наличные</span><b>{money(dashboard.cash)}</b></div><div><span>Карта</span><b>{money(dashboard.card)}</b></div><div><span>Средний чек</span><b>{money(dashboard.averageCheck)}</b></div></div>
    <button className="primary big" onClick={()=>setTab('order')}><Plus/> Новый заказ</button>
    <h2 className="section-title">Быстрый заказ</h2><div className="products">{products.filter(product=>product.quick&&product.variants.length).slice(0,6).map(product=><button className="product" key={product.id} onClick={()=>add(product)}><span>{product.icon||'☕'}</span><b>{product.name}</b><small>{money(product.variants[0].price)}</small></button>)}</div>
   </>}
  </main>}

  {tab==='order'&&<main>
   <div className="title-row"><div><small>Продажа</small><h1>Новый заказ</h1></div><button className="icon-button" onClick={()=>setTab('home')}><X/></button></div>
   {!dashboard?.currentShift?<div className="empty"><Clock/><h2>Смена закрыта</h2><p>Сначала откройте смену на главной.</p><button className="secondary" onClick={()=>setTab('home')}>На главную</button></div>:<>
    <div className="chips">{categories.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    <div className="products">{visibleProducts.map(product=><button className="product" key={product.id} onClick={()=>add(product)}><span>{product.icon||'☕'}</span><b>{product.name}</b><small>{product.variants[0].name} · {money(product.variants[0].price)}</small></button>)}</div>
    {cart.length>0&&<section className="cart"><div className="cart-head"><h2>Корзина</h2><button className="ghost danger" onClick={()=>setCart([])}><Trash2 size={16}/> Очистить</button></div>{cart.map(line=><div className="cart-line" key={`${line.variant.id}-${line.modifiers.join('-')}`}><div><b>{line.product.name}</b><small>{line.variant.name} · {money(line.variant.price+line.modifiers.reduce((sum,name)=>sum+modifierPrices[name],0))}</small><div className="modifiers">{modifiers.map(modifier=><button key={modifier.name} className={line.modifiers.includes(modifier.name)?'selected':''} onClick={()=>toggleModifier(line.variant.id,modifier.name)}>{modifier.label}</button>)}</div></div><div className="quantity"><button onClick={()=>changeQuantity(line.variant.id,-1)}><Minus/></button><b>{line.quantity}</b><button onClick={()=>changeQuantity(line.variant.id,1)}><Plus/></button></div><strong>{money(lineTotal(line))}</strong></div>)}<div className="total"><span>Итого</span><b>{money(total)}</b></div><div className="pay"><button className={payment==='Cash'?'selected':''} onClick={()=>setPayment('Cash')}>Наличные</button><button className={payment==='Card'?'selected':''} onClick={()=>setPayment('Card')}>Карта</button></div><button className="primary" onClick={checkout} disabled={!payment||busy}>{busy?'Сохраняем…':'Подтвердить оплату'} <Check size={18}/></button></section>}
   </>}
  </main>}

  {tab==='orders'&&<main><div className="title-row"><div><small>Последние 200</small><h1>Заказы</h1></div><button className="icon-button" onClick={()=>refresh(analyticsPeriod).catch(error=>setToast(error.message))}><RefreshCw/></button></div>{orders.map(order=><article className="order-card" key={order.id}><div className="order-top"><div><b>Заказ #{order.number}</b><small>{dateTime(order.createdAt)}</small></div><strong>{money(order.totalAmount)}</strong></div><div className="order-items">{order.items.map((item,index)=><span key={index}>{item.name} × {item.quantity}</span>)}</div><small>{order.payments.map(item=>item.method==='Cash'?'Наличные':'Карта').join(' + ')}</small></article>)}{orders.length===0&&<div className="empty"><ShoppingBag/><h2>Заказов пока нет</h2><p>Созданные продажи появятся здесь.</p></div>}</main>}

  {tab==='analytics'&&<main><div className="title-row"><div><small>{analyticsPeriod==='today'?'Текущий день':analyticsPeriod==='week'?'Последние 7 дней':'Текущий месяц'}</small><h1>Аналитика</h1></div><button className="icon-button" onClick={()=>selectAnalyticsPeriod(analyticsPeriod)}><RefreshCw/></button></div><div className="period-filter"><button className={analyticsPeriod==='today'?'active':''} onClick={()=>selectAnalyticsPeriod('today')}>Сегодня</button><button className={analyticsPeriod==='week'?'active':''} onClick={()=>selectAnalyticsPeriod('week')}>Неделя</button><button className={analyticsPeriod==='month'?'active':''} onClick={()=>selectAnalyticsPeriod('month')}>Месяц</button></div>{analytics&&<><div className="hero"><span>Выручка за период</span><b>{money(analytics.revenue)}</b><small>{analytics.ordersCount} заказов · средний чек {money(analytics.averageCheck)}</small></div><div className="stats"><div><span>Наличные</span><b>{money(analytics.cash)}</b></div><div><span>Карта</span><b>{money(analytics.card)}</b></div><div><span>Заказы</span><b>{analytics.ordersCount}</b></div></div><section className="chart-card report-download"><div className="report-download-head"><div><small>Дневной отчёт</small><h2>Отчёт за день</h2></div><Download/></div><p>Выберите дату, просмотрите расчёт или получите готовый PDF в чате с ботом.</p><div className="date-selects"><label>День<select value={reportDay} onChange={event=>setReportDatePart('day',Number(event.target.value))}>{reportDays.map(day=><option key={day} value={day}>{day}</option>)}</select></label><label>Месяц<select value={reportMonth} onChange={event=>setReportDatePart('month',Number(event.target.value))}>{months.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></label><label>Год<select value={reportYear} onChange={event=>setReportDatePart('year',Number(event.target.value))}>{reportYears.map(year=><option key={year} value={year}>{year}</option>)}</select></label></div><div className="report-actions"><button className="secondary" onClick={previewDailyReport} disabled={reportBusy}><Eye size={18}/> Просмотреть</button><button className="primary" onClick={downloadDailyPdf} disabled={reportBusy}>{reportBusy?'Формируем…':'Скачать PDF'} <Download size={18}/></button></div></section><section className="chart-card"><h2>По дням</h2><div className={`chart ${analyticsPeriod==='month'?'month-chart':''}`}>{analytics.daily.map(day=><div className="bar-wrap" key={day.date}><div className="bar-value">{day.ordersCount||''}</div><div className="bar" style={{height:`${Math.max(4,day.revenue/maxChart*120)}px`}}></div><small>{analyticsPeriod==='month'?new Date(`${day.date}T00:00:00`).getDate():new Date(`${day.date}T00:00:00`).toLocaleDateString('ru-RU',{weekday:'short'})}</small></div>)}</div></section></>}</main>}

  {tab==='more'&&<main><small>Настройки и касса</small><h1>Ещё</h1><section className="profile-card"><div className="profile-avatar">{dashboard?.me?.firstName?.[0]||'Б'}</div><div><b>{dashboard?.me?.firstName} {dashboard?.me?.lastName||''}</b><small>{dashboard?.me?.username?'@'+dashboard.me.username:dashboard?.me?.role}</small></div></section>{dashboard?.me?.role==='Admin'&&<button className="admin-entry" onClick={openSettings}><span><ShieldCheck/><b>Настройки владельца</b><small>Ассортимент, цены и история</small></span><ArrowRight/></button>}{dashboard?.currentShift?<section className="close-card"><h2>Закрытие смены</h2><div className="closing-summary"><div><span>Наличные</span><b>{money(dashboard.cash)}</b></div><div><span>Карта</span><b>{money(dashboard.card)}</b></div></div><p>Ожидается в кассе: <b>{money(dashboard.currentShift.openingCash+dashboard.cash)}</b></p><label>Фактически в кассе<input inputMode="decimal" value={actualCash} onChange={event=>setActualCash(event.target.value)} placeholder="Сумма после пересчёта"/></label><label>Комментарий<input value={closeComment} onChange={event=>setCloseComment(event.target.value)} placeholder="Необязательно"/></label><button className="primary danger-button" onClick={closeShift} disabled={busy}>{busy?'Закрываем…':'Закрыть смену'}</button></section>:<div className="empty"><Clock/><h2>Нет открытой смены</h2><button className="secondary" onClick={()=>setTab('home')}>Открыть смену</button></div>}<section className="about"><b>Coffee Control</b><small>Касса, смены, заказы и аналитика</small></section></main>}

  {tab==='settings'&&dashboard?.me?.role==='Admin'&&<main className="admin-page"><div className="title-row"><div><small>Только для владельца</small><h1>Настройки</h1></div><button className="icon-button" onClick={()=>setTab('more')}><ArrowLeft/></button></div>{adminCatalog&&<div className="admin-stats"><div><span>В продаже</span><b>{adminCatalog.activeCount}</b></div><div><span>Скрыто</span><b>{adminCatalog.hiddenCount}</b></div></div>}
   <section className="admin-section"><div className="admin-section-head"><div><Package/><div><h2>Ассортимент</h2><small>Добавление, цены и доступность</small></div></div></div>
    <details className="add-product"><summary><Plus size={17}/> Добавить позицию</summary><div className="product-form"><label>Название<input value={newProduct.name} onChange={event=>setNewProduct({...newProduct,name:event.target.value})} placeholder="Например, Чизкейк"/></label><div className="form-grid"><label>Категория<input list="admin-categories" value={newProduct.category} onChange={event=>setNewProduct({...newProduct,category:event.target.value})}/></label><label>Иконка<input value={newProduct.icon} onChange={event=>setNewProduct({...newProduct,icon:event.target.value})} maxLength={8}/></label></div><div className="form-grid"><label>Вариант<input value={newProduct.variantName} onChange={event=>setNewProduct({...newProduct,variantName:event.target.value})}/></label><label>Цена<input inputMode="decimal" value={newProduct.price} onChange={event=>setNewProduct({...newProduct,price:event.target.value})} placeholder="0"/></label></div><label className="switch-row"><input type="checkbox" checked={newProduct.quick} onChange={event=>setNewProduct({...newProduct,quick:event.target.checked})}/><span>Показывать в быстром заказе</span></label><button className="primary" onClick={()=>saveProduct()} disabled={adminBusy}><Plus size={18}/> Добавить</button></div></details>
    <datalist id="admin-categories">{adminCatalog?.categories.map(item=><option key={item.name} value={item.name}/>)}</datalist>
    <div className="admin-products">{adminCatalog?.products.map(product=><article className={`admin-product ${product.active?'':'inactive'}`} key={product.id}><div className="admin-product-head"><div><b>{product.icon||'☕'} {product.name}</b><small>{product.category} · {money(product.variants[0]?.price||0)}</small></div><span>{product.active?'В продаже':'Скрыто'}</span></div>{editingProduct===product.id?<div className="product-form compact"><label>Название<input value={productDraft.name} onChange={event=>setProductDraft({...productDraft,name:event.target.value})}/></label><div className="form-grid"><label>Категория<input list="admin-categories" value={productDraft.category} onChange={event=>setProductDraft({...productDraft,category:event.target.value})}/></label><label>Иконка<input value={productDraft.icon} onChange={event=>setProductDraft({...productDraft,icon:event.target.value})}/></label></div><div className="form-grid"><label>Вариант<input value={productDraft.variantName} onChange={event=>setProductDraft({...productDraft,variantName:event.target.value})}/></label><label>Цена<input inputMode="decimal" value={productDraft.price} onChange={event=>setProductDraft({...productDraft,price:event.target.value})}/></label></div><label className="switch-row"><input type="checkbox" checked={productDraft.quick} onChange={event=>setProductDraft({...productDraft,quick:event.target.checked})}/><span>Быстрый заказ</span></label><div className="admin-actions"><button className="secondary" onClick={()=>setEditingProduct(null)}>Отмена</button><button className="primary" onClick={()=>saveProduct(product.id)} disabled={adminBusy}><Save size={16}/> Сохранить</button></div></div>:<div className="admin-actions"><button className="secondary" onClick={()=>{setEditingProduct(product.id);setProductDraft(draftFromProduct(product))}}>Редактировать</button>{product.active?<button className="soft-danger" onClick={()=>hideProduct(product)} disabled={adminBusy}>Удалить</button>:<button className="restore" onClick={()=>restoreProduct(product)} disabled={adminBusy}>Вернуть</button>}</div>}</article>)}</div>
   </section>
   <section className="admin-section danger-zone"><div className="admin-section-head"><div><Trash2/><div><h2>Удаление истории</h2><small>Заказы, оплаты, смены и аналитика дня</small></div></div></div><p>Сначала проверьте объём данных. Удаление необратимо и затронет всех пользователей.</p><div className="date-selects"><label>День<select value={historyDay} onChange={event=>{setDatePart(historyDate,setHistoryDate,'day',Number(event.target.value));setHistorySummary(null)}}>{historyDays.map(day=><option key={day}>{day}</option>)}</select></label><label>Месяц<select value={historyMonth} onChange={event=>{setDatePart(historyDate,setHistoryDate,'month',Number(event.target.value));setHistorySummary(null)}}>{months.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></label><label>Год<select value={historyYear} onChange={event=>{setDatePart(historyDate,setHistoryDate,'year',Number(event.target.value));setHistorySummary(null)}}>{reportYears.map(year=><option key={year}>{year}</option>)}</select></label></div><button className="secondary" onClick={previewHistoryDelete} disabled={adminBusy}><Eye size={17}/> Проверить данные</button>{historySummary&&<div className="delete-preview"><b>{reportDateLabel(historyDate)}</b><div><span>Смены<strong>{historySummary.shifts}</strong></span><span>Заказы<strong>{historySummary.orders}</strong></span><span>Выручка<strong>{amount(historySummary.revenue)}</strong></span></div>{historySummary.openShifts>0&&<p className="warning">Есть открытые смены: {historySummary.openShifts}</p>}<label>Для подтверждения введите <b>{historyDate}</b><input value={deleteConfirmation} onChange={event=>setDeleteConfirmation(event.target.value)} placeholder={historyDate}/></label><button className="primary danger-button" onClick={deleteHistory} disabled={adminBusy||deleteConfirmation!==historyDate}><Trash2 size={17}/> Удалить историю дня</button></div>}</section>
  </main>}

  {reportPreview&&<div className="report-modal"><div className="report-sheet"><div className="report-modal-head"><div><small>COFFEE CONTROL</small><h2>Отчёт за {reportDateLabel(reportDate)}</h2></div><button className="icon-button" onClick={()=>setReportPreview(null)} aria-label="Закрыть"><X/></button></div><div className="preview-metrics"><div><span>Чашки</span><b>{reportPreview.cups}</b></div><div><span>Порции кофе</span><b>{reportPreview.coffeePortions}</b></div><div><span>Гриндер</span><b>{reportPreview.grinderPortions}</b></div><div><span>Без кофеина</span><b>{reportPreview.decafCoffees}</b></div></div><h3>Купленные позиции</h3><div className="preview-positions">{reportPreview.positions.length?reportPreview.positions.map(position=><div key={position.name}><span>{position.name}</span><b>{position.quantity}</b></div>):<p>Продаж за этот день нет</p>}</div><h3>Оплата</h3><div className="preview-payments"><div><span>Наличные</span><b>{amount(reportPreview.cash)}</b></div><div><span>Карта</span><b>{amount(reportPreview.card)}</b></div><div><span>Выручка</span><b>{amount(reportPreview.revenue)}</b></div></div><button className="primary" onClick={downloadDailyPdf} disabled={reportBusy}>{reportBusy?'Отправляем…':'Скачать PDF в бот'} <Download size={18}/></button><button className="secondary close-preview" onClick={()=>setReportPreview(null)}>Закрыть просмотр</button></div></div>}

  {tab!=='settings'&&<nav><button className={tab==='home'?'active':''} onClick={()=>setTab('home')}><Wallet/>Главная</button><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}><ShoppingBag/>Заказы</button><button className="add" aria-label="Создать заказ" onClick={()=>setTab('order')}><Plus strokeWidth={2.4}/></button><button className={tab==='analytics'?'active':''} onClick={()=>setTab('analytics')}><BarChart3/>Аналитика</button><button className={tab==='more'?'active':''} onClick={()=>setTab('more')}><MoreHorizontal/>Ещё</button></nav>}
 </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
