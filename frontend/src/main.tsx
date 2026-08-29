import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowRight,BarChart3,Check,Clock,Coffee,Minus,MoreHorizontal,Plus,RefreshCw,ShoppingBag,Trash2,Wallet,X} from 'lucide-react';
import './style.css';
import './enhancements.css';

type Variant={id:string,name:string,price:number,volumeMl?:number};
type Product={id:string,name:string,category:string,icon?:string,quick:boolean,variants:Variant[]};
type Shift={id:string,businessDate:string,openedAt:string,openingCash:number,expectedClosingCash:number,status:string};
type Me={firstName:string,lastName?:string,username?:string,role:string};
type Order={id:string,number:number,totalAmount:number,createdAt:string,status:string,payments:{method:string,amount:number}[],items:{name:string,variant:string,quantity:number,unitPrice:number,totalPrice:number}[]};
type Dashboard={me?:Me,currentShift:Shift|null,revenue:number,ordersCount:number,cash:number,card:number,averageCheck:number,recentOrders:Order[]};
type AnalyticsPeriod='today'|'week'|'month';
type Analytics={period:AnalyticsPeriod,periodDays:number,revenue:number,ordersCount:number,averageCheck:number,cash:number,card:number,daily:{date:string,revenue:number,ordersCount:number}[]};
type CartLine={product:Product,variant:Variant,quantity:number};
type Tab='home'|'order'|'orders'|'analytics'|'more';

const api=async<T,>(path:string,options:RequestInit={}):Promise<T>=>{
 const tg=(window as any).Telegram?.WebApp;
 const response=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-Telegram-Init-Data':tg?.initData||'',...(options.headers||{})}});
 if(!response.ok){const body=await response.json().catch(()=>null);const details=body?.message||body?.detail||Object.values(body?.errors||{}).flat().join(' ');throw new Error(details||`Ошибка сервера (${response.status})`)}
 return response.json();
};

const money=(value=0)=>new Intl.NumberFormat('uk-UA',{style:'currency',currency:'UAH',maximumFractionDigits:2}).format(value);
const dateTime=(value:string)=>new Date(value).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

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

 const refresh=useCallback(async(period:AnalyticsPeriod)=>{
  const [dash,orderList,report]=await Promise.all([api<Dashboard>('/api/dashboard'),api<Order[]>('/api/orders'),api<Analytics>(`/api/analytics?period=${period}`)]);
  setDashboard(dash);setOrders(orderList);setAnalytics(report);
 },[]);
 const selectAnalyticsPeriod=async(period:AnalyticsPeriod)=>{setAnalyticsPeriod(period);try{setAnalytics(await api<Analytics>(`/api/analytics?period=${period}`))}catch(error:any){setToast(error.message)}};

 useEffect(()=>{
  (window as any).Telegram?.WebApp?.ready();(window as any).Telegram?.WebApp?.expand?.();
  Promise.all([refresh('week'),api<Product[]>('/api/products').then(setProducts)]).catch(error=>setToast(error.message)).finally(()=>setLoading(false));
 },[refresh]);

 useEffect(()=>{if(dashboard?.currentShift&&!actualCash)setActualCash(String(dashboard.currentShift.expectedClosingCash||0))},[dashboard,actualCash]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),3500);return()=>clearTimeout(timer)},[toast]);

 const categories=useMemo(()=>['Все',...Array.from(new Set(products.map(product=>product.category)))],[products]);
 const visibleProducts=products.filter(product=>product.variants.length>0&&(category==='Все'||product.category===category));
 const total=cart.reduce((sum,line)=>sum+line.variant.price*line.quantity,0);
 const maxChart=Math.max(1,...(analytics?.daily.map(day=>day.revenue)||[1]));

 const add=(product:Product,variant=product.variants[0])=>{
  if(!variant)return;
  setCart(current=>{const found=current.find(line=>line.variant.id===variant.id);return found?current.map(line=>line.variant.id===variant.id?{...line,quantity:line.quantity+1}:line):[...current,{product,variant,quantity:1}]});
  setToast(`${product.name} добавлен`);
 };
 const changeQuantity=(variantId:string,delta:number)=>setCart(current=>current.map(line=>line.variant.id===variantId?{...line,quantity:line.quantity+delta}:line).filter(line=>line.quantity>0));

 const openShift=async()=>{
  const value=Number(openingCash.replace(',','.'));if(!Number.isFinite(value)||value<0){setToast('Введите корректную сумму в кассе');return}
  setBusy(true);try{await api('/api/shifts/open',{method:'POST',body:JSON.stringify({openingCash:value})});await refresh(analyticsPeriod);setOpeningCash('');setToast('Смена открыта')}catch(error:any){setToast(error.message)}finally{setBusy(false)}
 };
 const checkout=async()=>{
  if(!payment||!dashboard?.currentShift||cart.length===0||total<=0)return;
  setBusy(true);try{
   await api('/api/orders',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),items:cart.map(line=>({variantId:line.variant.id,quantity:line.quantity})),payments:[{method:payment,amount:total}]})});
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
    {cart.length>0&&<section className="cart"><div className="cart-head"><h2>Корзина</h2><button className="ghost danger" onClick={()=>setCart([])}><Trash2 size={16}/> Очистить</button></div>{cart.map(line=><div className="cart-line" key={line.variant.id}><div><b>{line.product.name}</b><small>{line.variant.name} · {money(line.variant.price)}</small></div><div className="quantity"><button onClick={()=>changeQuantity(line.variant.id,-1)}><Minus/></button><b>{line.quantity}</b><button onClick={()=>changeQuantity(line.variant.id,1)}><Plus/></button></div><strong>{money(line.variant.price*line.quantity)}</strong></div>)}<div className="total"><span>Итого</span><b>{money(total)}</b></div><div className="pay"><button className={payment==='Cash'?'selected':''} onClick={()=>setPayment('Cash')}>Наличные</button><button className={payment==='Card'?'selected':''} onClick={()=>setPayment('Card')}>Карта</button></div><button className="primary" onClick={checkout} disabled={!payment||busy}>{busy?'Сохраняем…':'Подтвердить оплату'} <Check size={18}/></button></section>}
   </>}
  </main>}

  {tab==='orders'&&<main><div className="title-row"><div><small>Последние 200</small><h1>Заказы</h1></div><button className="icon-button" onClick={()=>refresh(analyticsPeriod).catch(error=>setToast(error.message))}><RefreshCw/></button></div>{orders.map(order=><article className="order-card" key={order.id}><div className="order-top"><div><b>Заказ #{order.number}</b><small>{dateTime(order.createdAt)}</small></div><strong>{money(order.totalAmount)}</strong></div><div className="order-items">{order.items.map((item,index)=><span key={index}>{item.name} × {item.quantity}</span>)}</div><small>{order.payments.map(item=>item.method==='Cash'?'Наличные':'Карта').join(' + ')}</small></article>)}{orders.length===0&&<div className="empty"><ShoppingBag/><h2>Заказов пока нет</h2><p>Созданные продажи появятся здесь.</p></div>}</main>}

  {tab==='analytics'&&<main><div className="title-row"><div><small>{analyticsPeriod==='today'?'Текущий день':analyticsPeriod==='week'?'Последние 7 дней':'Текущий месяц'}</small><h1>Аналитика</h1></div><button className="icon-button" onClick={()=>selectAnalyticsPeriod(analyticsPeriod)}><RefreshCw/></button></div><div className="period-filter"><button className={analyticsPeriod==='today'?'active':''} onClick={()=>selectAnalyticsPeriod('today')}>Сегодня</button><button className={analyticsPeriod==='week'?'active':''} onClick={()=>selectAnalyticsPeriod('week')}>Неделя</button><button className={analyticsPeriod==='month'?'active':''} onClick={()=>selectAnalyticsPeriod('month')}>Месяц</button></div>{analytics&&<><div className="hero"><span>Выручка за период</span><b>{money(analytics.revenue)}</b><small>{analytics.ordersCount} заказов · средний чек {money(analytics.averageCheck)}</small></div><div className="stats"><div><span>Наличные</span><b>{money(analytics.cash)}</b></div><div><span>Карта</span><b>{money(analytics.card)}</b></div><div><span>Заказы</span><b>{analytics.ordersCount}</b></div></div><section className="chart-card"><h2>По дням</h2><div className={`chart ${analyticsPeriod==='month'?'month-chart':''}`}>{analytics.daily.map(day=><div className="bar-wrap" key={day.date}><div className="bar-value">{day.ordersCount||''}</div><div className="bar" style={{height:`${Math.max(4,day.revenue/maxChart*120)}px`}}></div><small>{analyticsPeriod==='month'?new Date(`${day.date}T00:00:00`).getDate():new Date(`${day.date}T00:00:00`).toLocaleDateString('ru-RU',{weekday:'short'})}</small></div>)}</div></section></>}</main>}

  {tab==='more'&&<main><small>Настройки и касса</small><h1>Ещё</h1><section className="profile-card"><div className="profile-avatar">{dashboard?.me?.firstName?.[0]||'Б'}</div><div><b>{dashboard?.me?.firstName} {dashboard?.me?.lastName||''}</b><small>{dashboard?.me?.username?'@'+dashboard.me.username:dashboard?.me?.role}</small></div></section>{dashboard?.currentShift?<section className="close-card"><h2>Закрытие смены</h2><p>Ожидается в кассе: <b>{money(dashboard.currentShift.openingCash+dashboard.cash)}</b></p><label>Фактически в кассе<input inputMode="decimal" value={actualCash} onChange={event=>setActualCash(event.target.value)} placeholder="Сумма после пересчёта"/></label><label>Комментарий<input value={closeComment} onChange={event=>setCloseComment(event.target.value)} placeholder="Необязательно"/></label><button className="primary danger-button" onClick={closeShift} disabled={busy}>{busy?'Закрываем…':'Закрыть смену'}</button></section>:<div className="empty"><Clock/><h2>Нет открытой смены</h2><button className="secondary" onClick={()=>setTab('home')}>Открыть смену</button></div>}<section className="about"><b>Coffee Control</b><small>Касса, смены, заказы и аналитика</small></section></main>}

  <nav><button className={tab==='home'?'active':''} onClick={()=>setTab('home')}><Wallet/>Главная</button><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}><ShoppingBag/>Заказы</button><button className="add" aria-label="Создать заказ" onClick={()=>setTab('order')}><Plus strokeWidth={2.4}/></button><button className={tab==='analytics'?'active':''} onClick={()=>setTab('analytics')}><BarChart3/>Аналитика</button><button className={tab==='more'?'active':''} onClick={()=>setTab('more')}><MoreHorizontal/>Ещё</button></nav>
 </div>;
}

createRoot(document.getElementById('root')!).render(<App/>);
