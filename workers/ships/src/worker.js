const AIS_WS_URL='wss://stream.aisstream.io/v0/stream';
const RECONNECT_MIN_MS=5000, STALE_SHIP_MS=20*60*1000, ALARM_INTERVAL_MS=15000;

export class ShipsSocket {
  constructor(state,env){
    this.state=state; this.env=env; this.ships=new Map(); this.ws=null;
    this.lastConnectAttempt=0; this.lastMessageAt=0; this.connectError=null;
  }
  async ensureAlarm(){
    if(await this.state.storage.getAlarm()==null) await this.state.storage.setAlarm(Date.now()+ALARM_INTERVAL_MS);
  }
  connect(){
    if(!this.env.AISSTREAM_KEY){ this.connectError='AISSTREAM_KEY není nastavený'; return; }
    if(this.ws){ try{this.ws.close();}catch(e){} this.ws=null; }
    const now=Date.now(); if(now-this.lastConnectAttempt<RECONNECT_MIN_MS) return;
    this.lastConnectAttempt=now;
    try{
      // Cloudflare podporuje odchozí spojení standardním WebSocket klientem.
      // Starší varianta přes fetch(wss://...) končila chybou ještě před handshake.
      const ws=new WebSocket(AIS_WS_URL);
      this.ws=ws; this.connectError=null;
      ws.addEventListener('message',ev=>this.onMessage(ev));
      ws.addEventListener('close',()=>{if(this.ws===ws)this.ws=null;});
      ws.addEventListener('error',()=>{if(this.ws===ws)this.ws=null;});
      ws.addEventListener('open',()=>ws.send(JSON.stringify({APIKey:this.env.AISSTREAM_KEY,
        BoundingBoxes:[[[-90,-180],[90,180]]],
        FilterMessageTypes:['PositionReport','StandardClassBPositionReport','ExtendedClassBPositionReport','StaticDataReport','ShipStaticData']})));
    }catch(e){this.connectError=String(e);this.ws=null;}
  }
  onMessage(ev){
    this.lastMessageAt=Date.now();
    let d; try{d=JSON.parse(ev.data);}catch(e){return;}
    if(d.error){this.connectError=String(d.error);return;}
    const meta=d.MetaData||{}, payload=(d.Message&&d.Message[d.MessageType])||{};
    const reportA=payload.ReportA||{}, reportB=payload.ReportB||{};
    const mmsi=meta.MMSI??payload.UserID??reportA.UserID??reportB.UserID;
    if(mmsi==null)return;
    const id=String(mmsi),old=this.ships.get(id)||{mmsi:id};
    const lat=meta.latitude??meta.Latitude??payload.Latitude;
    const lon=meta.longitude??meta.Longitude??payload.Longitude;
    const clean=v=>typeof v==='string'?v.replace(/@+$/g,'').trim():'';
    const name=clean(meta.ShipName)||clean(payload.Name)||clean(reportA.Name)||old.name||null;
    const callSign=clean(payload.CallSign)||clean(reportB.CallSign)||old.callSign||null;
    const destination=clean(payload.Destination)||old.destination||null;
    const type=Number.isFinite(payload.Type)?payload.Type:Number.isFinite(payload.ShipType)?payload.ShipType:
      Number.isFinite(reportB.ShipType)?reportB.ShipType:(old.type??null);
    const next={...old,mmsi:id,name,callSign,destination,type,t:this.lastMessageAt};
    if(typeof lat==='number'&&typeof lon==='number'&&Math.abs(lat)<=90&&Math.abs(lon)<=180){
      Object.assign(next,{lat,lon,cog:typeof payload.Cog==='number'?payload.Cog:(old.cog??null),
        sog:typeof payload.Sog==='number'?payload.Sog:(old.sog??null),
        heading:(typeof payload.TrueHeading==='number'&&payload.TrueHeading<511)?payload.TrueHeading:(old.heading??null),
        navStatus:typeof payload.NavigationalStatus==='number'?payload.NavigationalStatus:(old.navStatus??null)});
    }
    this.ships.set(id,next);
  }
  pruneStale(){const cutoff=Date.now()-STALE_SHIP_MS;for(const[id,s]of this.ships)if(s.t<cutoff)this.ships.delete(id);}
  async alarm(){
    this.pruneStale();
    if(!this.ws||(this.lastMessageAt&&Date.now()-this.lastMessageAt>90000))this.connect();
    await this.ensureAlarm();
  }
  async fetch(){
    await this.ensureAlarm(); if(!this.ws&&!this.connectError)this.connect(); this.pruneStale();
    return new Response(JSON.stringify({t:Date.now(),connected:!!this.ws,error:this.ws?null:this.connectError,
      items:[...this.ships.values()].filter(s=>typeof s.lat==='number'&&typeof s.lon==='number')}),
      {headers:{'Content-Type':'application/json; charset=utf-8'}});
  }
}
export default {async fetch(request,env){return env.SHIPS.get(env.SHIPS.idFromName('global')).fetch(request);}};
