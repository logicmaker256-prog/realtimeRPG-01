//////////////////////////////////////////////////////
// ゲーム状態
//////////////////////////////////////////////////////
let gameStarted = false;
let gameOver    = false;
let gameCleared = false;
let inShop      = false;
let currentFloor = 1;

// プレイヤーデータ
let playerLevel  = 1;
let playerHP     = 100;
let playerMaxHP  = 100;
let playerMP     = 50;
let playerMaxMP  = 50;
let playerEXP    = 0;
let playerGold   = 50;
let hpPotCount   = 3;
let mpPotCount   = 3;
let equippedWeapon = "knife";
let equippedArmor  = "cloth";

// 勇者パラメータ（初期値1）
let statVit = 1;
let statAtk = 1;
let statDef = 1;
let statInt = 1;
let statAgi = 1;
let statPoints = 0;

// 敵状態引き継ぎ
let savedSlimesKilled = 0;
let savedBossSpawned  = false;

// セッションキー
const SESSION_KEY = "dungeonQuest_session";

// sessionStorageから引き継ぎデータを読み込む
(function loadSession(){
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if(!raw) return;
        const d = JSON.parse(raw);
        currentFloor      = d.floor      || 1;
        playerLevel       = d.lv         || 1;
        playerHP          = d.hp         || 100;
        playerMP          = d.mp         || 50;
        playerEXP         = d.exp        || 0;
        playerGold        = d.gold       || 50;
        hpPotCount        = d.hppot      || 0;
        mpPotCount        = d.mppot      || 0;
        equippedWeapon    = d.wpn        || "knife";
        equippedArmor     = d.arm        || "cloth";
        statVit           = d.vit        || 1;
        statAtk           = d.atk        || 1;
        statDef           = d.def        || 1;
        statInt           = d.int        || 1;
        statAgi           = d.agi        || 1;
        statPoints        = d.spt        || 0;
        savedSlimesKilled = d.killed     || 0;
        savedBossSpawned  = d.boss       === 1;
        // 読み込んだら消す（次回は新規扱い）
        sessionStorage.removeItem(SESSION_KEY);
    } catch(e){}
})();

//////////////////////////////////////////////////////
// UI要素
//////////////////////////////////////////////////////
const hpText        = document.getElementById("hpText");
const mpText        = document.getElementById("mpText");
const enemyText     = document.getElementById("enemyText");
const levelText     = document.getElementById("levelText");
const message       = document.getElementById("message");
const hpBar         = document.getElementById("hpBar");
const mpBar         = document.getElementById("mpBar");
const expBar        = document.getElementById("expBar");
const minimapCanvas = document.getElementById("minimap");
const minimapCtx    = minimapCanvas.getContext("2d");
const gameUI        = document.getElementById("gameUI");
const goldText      = document.getElementById("goldText");
const weaponText    = document.getElementById("weaponText");
const armorText     = document.getElementById("armorText");
const atkText       = document.getElementById("atkText");
const defText       = document.getElementById("defText");
const floorText     = document.getElementById("floorText");
const MM = 140;
minimapCanvas.width  = MM;
minimapCanvas.height = MM;

//////////////////////////////////////////////////////
// メッセージ
//////////////////////////////////////////////////////
let msgTimer = null;
function showMessage(text){
    message.textContent = text;
    message.classList.add("visible");
    clearTimeout(msgTimer);
    msgTimer = setTimeout(()=>{ message.classList.remove("visible"); }, 2000);
}

//////////////////////////////////////////////////////
// アイテム定義
//////////////////////////////////////////////////////
const ITEMS = {
    // 武器
    knife:       { id:"knife",       name:"ナイフ",        price:50,  tab:"weapon", desc:"ATK +20",  atk:20  },
    shortsword:  { id:"shortsword",  name:"ショートソード", price:100, tab:"weapon", desc:"ATK +40",  atk:40  },
    longsword:   { id:"longsword",   name:"ロングソード",   price:200, tab:"weapon", desc:"ATK +80",  atk:80  },
    mithrilsword:{ id:"mithrilsword",name:"ミスリルソード", price:400, tab:"weapon", desc:"ATK +160", atk:160 },
    // 防具
    cloth:      { id:"cloth",      name:"服",           price:10,  tab:"armor", desc:"DEF +10", def:10 },
    leather:    { id:"leather",    name:"レザーメイル",  price:100, tab:"armor", desc:"DEF +20", def:20 },
    chain:      { id:"chain",      name:"チェインメイル",price:200, tab:"armor", desc:"DEF +40", def:40 },
    plate:      { id:"plate",      name:"プレートメイル",price:400, tab:"armor", desc:"DEF +80", def:80 },
    // 消耗品（ショップで購入）
    hp_potion: { id:"hp_potion", name:"HP回復薬", price:30, tab:"item", desc:"HP全回復 ×1個", effect:"hp" },
    mp_potion: { id:"mp_potion", name:"MP回復薬", price:40, tab:"item", desc:"MP全回復 ×1個", effect:"mp" },
};

let attacking      = false;
let attackCooldown = 0;

function getAGIFrames(){ return Math.max(10, 30 - statAgi); }
function getATK(){ return (equippedWeapon ? ITEMS[equippedWeapon].atk : 0) + statAtk; }
function getDEF(){ return (equippedArmor  ? ITEMS[equippedArmor].def  : 0) + statDef; }
function getMagicDmg(){ return 15 + 5 * statInt; }

function expNeeded(lv){ return (lv + 1) * 100; }

function recalcStats(){
    playerMaxHP = 90 + 10 * statVit;
    playerMaxMP = 40 + 10 * statInt;
    playerHP = Math.min(playerHP, playerMaxHP);
    playerMP = Math.min(playerMP, playerMaxMP);
}

function gainEXP(amount){
    playerEXP += amount;
    const need = expNeeded(playerLevel);
    if(playerEXP >= need){
        playerEXP -= need;
        playerLevel++;
        statPoints += 3;
        recalcStats();
        playerHP = playerMaxHP;
        playerMP = playerMaxMP;
        levelText.textContent = playerLevel;
        showMessage("Lv." + playerLevel + " レベルアップ！ ポイント+3 💪");
        showLevelupEffect();
        // ポイントが残っていたら割り振りUIを開く
        setTimeout(()=>{ openStatusUI(); }, 500);
    }
    updateUI();
}

function showLevelupEffect(){
    const el = document.getElementById("levelupMsg");
    el.style.display = "block";
    el.style.animation = "none";
    el.offsetHeight;
    el.style.animation = "levelupAnim 2s ease forwards";
    setTimeout(()=>{ el.style.display = "none"; }, 2000);
}

function calcDamage(atk, def){
    const dmg = atk - def;
    return Math.max(1, dmg);
}

//////////////////////////////////////////////////////
// UI更新
//////////////////////////////////////////////////////
function updateUI(){
    const hpPct = Math.max(0, playerHP / playerMaxHP * 100);
    hpBar.style.width = hpPct + "%";
    hpBar.style.background = hpPct > 50
        ? "linear-gradient(90deg,#22c55e,#4ade80)"
        : hpPct > 25
        ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
        : "linear-gradient(90deg,#ef4444,#f87171)";
    hpText.textContent = Math.max(0, Math.ceil(playerHP)) + "/" + playerMaxHP;
    mpBar.style.width  = (playerMP / playerMaxMP * 100) + "%";
    mpText.textContent = Math.ceil(playerMP) + "/" + playerMaxMP;
    expBar.style.width = (playerEXP / expNeeded(playerLevel) * 100) + "%";
    levelText.textContent  = playerLevel;
    goldText.textContent   = playerGold;
    weaponText.textContent = equippedWeapon ? ITEMS[equippedWeapon].name : "なし";
    armorText.textContent  = equippedArmor  ? ITEMS[equippedArmor].name  : "なし";
    atkText.textContent    = getATK();
    defText.textContent    = getDEF();
    floorText.textContent  = currentFloor;
    // ステータス詳細
    const sEl = document.getElementById("statDetail");
    if(sEl) sEl.textContent =
        "VIT:"+statVit+" ATK:"+statAtk+" DEF:"+statDef+" INT:"+statInt+" AGI:"+statAgi +
        (statPoints>0 ? "  ✨PT:"+statPoints : "");
    document.getElementById("shopGoldText").textContent = playerGold;
    const hpBtn = document.getElementById("hpPotBtn");
    const mpBtn = document.getElementById("mpPotBtn");
    if(hpBtn){ document.getElementById("hpPotCount").textContent=hpPotCount; hpBtn.disabled=(hpPotCount<=0); }
    if(mpBtn){ document.getElementById("mpPotCount").textContent=mpPotCount; mpBtn.disabled=(mpPotCount<=0); }
}

//////////////////////////////////////////////////////
// Three.js シーン
//////////////////////////////////////////////////////
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111118);
scene.fog = new THREE.Fog(0x111118, 20, 80);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x334455, 0.8);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

//////////////////////////////////////////////////////
// BSP ダンジョン生成
//////////////////////////////////////////////////////
const MAP_W = 50, MAP_H = 50, TILE = 3, MIN_ROOM = 6;
// 0=壁, 1=部屋床, 2=廊下床, 3=ショップ床
const mapData = [];
for(let z=0;z<MAP_H;z++){ mapData[z]=[]; for(let x=0;x<MAP_W;x++) mapData[z][x]=0; }

const rooms = [];

function bspSplit(x,z,w,h,depth){
    if(depth===0||(w<MIN_ROOM*2+2&&h<MIN_ROOM*2+2)){ carveRoom(x,z,w,h); return; }
    const canH=w>=MIN_ROOM*2+2, canV=h>=MIN_ROOM*2+2;
    const splitH=canH&&(!canV||Math.random()<0.5);
    if(splitH){
        const cut=MIN_ROOM+Math.floor(Math.random()*(w-MIN_ROOM*2-1));
        bspSplit(x,z,cut,h,depth-1); bspSplit(x+cut,z,w-cut,h,depth-1);
    } else {
        const cut=MIN_ROOM+Math.floor(Math.random()*(h-MIN_ROOM*2-1));
        bspSplit(x,z,w,cut,depth-1); bspSplit(x,z+cut,w,h-cut,depth-1);
    }
}

function carveRoom(bx,bz,bw,bh){
    const margin=1;
    const rw=Math.max(3,bw-margin*2-Math.floor(Math.random()*2));
    const rh=Math.max(3,bh-margin*2-Math.floor(Math.random()*2));
    const ox=bx+margin+Math.floor(Math.random()*(bw-margin*2-rw+1));
    const oz=bz+margin+Math.floor(Math.random()*(bh-margin*2-rh+1));
    if(ox<1||oz<1||ox+rw>MAP_W-1||oz+rh>MAP_H-1) return;
    for(let z=oz;z<oz+rh;z++) for(let x=ox;x<ox+rw;x++) mapData[z][x]=1;
    rooms.push({x:ox,z:oz,w:rw,h:rh,cx:ox+Math.floor(rw/2),cz:oz+Math.floor(rh/2),isShop:false});
}

function carveHLine(x1,x2,z){
    const a=Math.min(x1,x2),b=Math.max(x1,x2);
    for(let x=a;x<=b;x++) for(let dz=-1;dz<=1;dz++){
        const zz=z+dz;
        if(zz>=0&&zz<MAP_H&&x>=0&&x<MAP_W&&mapData[zz][x]===0) mapData[zz][x]=2;
    }
}
function carveVLine(z1,z2,x){
    const a=Math.min(z1,z2),b=Math.max(z1,z2);
    for(let z=a;z<=b;z++) for(let dx=-1;dx<=1;dx++){
        const xx=x+dx;
        if(z>=0&&z<MAP_H&&xx>=0&&xx<MAP_W&&mapData[z][xx]===0) mapData[z][xx]=2;
    }
}
function carveCorridor(x1,z1,x2,z2){
    if(Math.random()<0.5){ carveHLine(x1,x2,z1); carveVLine(z1,z2,x2); }
    else                  { carveVLine(z1,z2,x1); carveHLine(x1,x2,z2); }
}

bspSplit(0,0,MAP_W,MAP_H,4);
const shuffled=[...rooms].sort(()=>Math.random()-0.5);
for(let i=1;i<shuffled.length;i++)
    carveCorridor(shuffled[i-1].cx,shuffled[i-1].cz,shuffled[i].cx,shuffled[i].cz);

//////////////////////////////////////////////////////
// ショップ部屋を決定
//////////////////////////////////////////////////////
const startRoom = rooms[0];
const otherRooms = rooms.filter(r=>r!==startRoom).sort((a,b)=>{
    const da=Math.hypot(a.cx-startRoom.cx,a.cz-startRoom.cz);
    const db=Math.hypot(b.cx-startRoom.cx,b.cz-startRoom.cz);
    return db-da;
});
const bossRoom  = otherRooms[0];
// ショップ：中間距離の部屋を1つ選ぶ
const mid = Math.floor(otherRooms.length/2);
const shopRoom = otherRooms[mid];
shopRoom.isShop = true;
// ショップ部屋の床を種類3にマーク
for(let z=shopRoom.z;z<shopRoom.z+shopRoom.h;z++)
    for(let x=shopRoom.x;x<shopRoom.x+shopRoom.w;x++)
        mapData[z][x]=3;

const slimeRooms = otherRooms.filter(r=>r!==bossRoom&&r!==shopRoom).slice(0,5);

//////////////////////////////////////////////////////
// 3Dメッシュ生成
//////////////////////////////////////////////////////
const floorMat = new THREE.MeshLambertMaterial({color:0x3a2a1a});
const corrMat  = new THREE.MeshLambertMaterial({color:0x2a1e10});
const shopMat  = new THREE.MeshLambertMaterial({color:0x1a2a3a});
const wallMat  = new THREE.MeshLambertMaterial({color:0x4a4a5a});
const ceilMat  = new THREE.MeshLambertMaterial({color:0x222230});
const floorGeo = new THREE.PlaneGeometry(TILE,TILE);
const wallGeo  = new THREE.BoxGeometry(TILE,4,TILE);
const ceilGeo  = new THREE.PlaneGeometry(TILE,TILE);

const walkableMap = {};
for(let z=0;z<MAP_H;z++){
    for(let x=0;x<MAP_W;x++){
        const wx=x*TILE,wz=z*TILE,t=mapData[z][x];
        if(t===0){
            const w=new THREE.Mesh(wallGeo,wallMat.clone());
            w.position.set(wx,2,wz); w.castShadow=true; w.receiveShadow=true;
            scene.add(w); walkableMap[x+","+z]=false;
        } else {
            const mat = t===3 ? shopMat.clone() : t===1 ? floorMat.clone() : corrMat.clone();
            const f=new THREE.Mesh(floorGeo,mat);
            f.rotation.x=-Math.PI/2; f.position.set(wx,0,wz);
            f.receiveShadow=true; f.userData.walkable=true;
            scene.add(f);
            const c=new THREE.Mesh(ceilGeo,ceilMat.clone());
            c.rotation.x=Math.PI/2; c.position.set(wx,4,wz);
            scene.add(c);
            walkableMap[x+","+z]=true;
        }
    }
}

// ショップ看板（青い光の柱）
const signGeo  = new THREE.BoxGeometry(1,2,1);
const signMat  = new THREE.MeshLambertMaterial({color:0x00aaff,emissive:0x0066cc,emissiveIntensity:0.8});
const shopSign = new THREE.Mesh(signGeo, signMat);
shopSign.position.set(shopRoom.cx*TILE, 1, shopRoom.cz*TILE);
scene.add(shopSign);
const shopLight = new THREE.PointLight(0x00aaff,3,12);
shopLight.position.set(shopRoom.cx*TILE,3,shopRoom.cz*TILE);
scene.add(shopLight);

function isWalkable(tx,tz){ return walkableMap[tx+","+tz]===true; }
function isShopRoom(wx,wz){
    const tx=Math.round(wx/TILE), tz=Math.round(wz/TILE);
    return tx>=shopRoom.x&&tx<shopRoom.x+shopRoom.w&&tz>=shopRoom.z&&tz<shopRoom.z+shopRoom.h;
}

//////////////////////////////////////////////////////
// プレイヤー
//////////////////////////////////////////////////////
const player = new THREE.Group();
const bodyMat = new THREE.MeshLambertMaterial({color:0x3399ff});
const bodyMesh= new THREE.Mesh(new THREE.BoxGeometry(1.0,1.8,1.0),bodyMat);
bodyMesh.position.y=0.9; bodyMesh.castShadow=true;
player.add(bodyMesh);
const headMesh=new THREE.Mesh(new THREE.SphereGeometry(0.42,12,12),
    new THREE.MeshLambertMaterial({color:0xffddaa}));
headMesh.position.y=2.0; player.add(headMesh);
const swordMesh=new THREE.Mesh(new THREE.BoxGeometry(0.15,1.2,0.15),
    new THREE.MeshLambertMaterial({color:0xccddff}));
swordMesh.position.set(0.75,1.0,0); player.add(swordMesh);
const lantern=new THREE.PointLight(0xffaa44,2.5,18);
lantern.position.set(0,2,0); player.add(lantern);
player.position.set(startRoom.cx*TILE,0,startRoom.cz*TILE);
scene.add(player);

//////////////////////////////////////////////////////
// 階層別モンスター定義
//////////////////////////////////////////////////////
const FLOOR_DATA = {
    1:{ small:{ name:"スライム",       hp:25, atk:15, def:10, spd:0.04, cd:60, color:0x44ff44, scale:1.0, exp:10  },
        boss: { name:"ジャイアントスライム",hp:50,atk:30,def:20,spd:0.06,cd:50,color:0x00cc00,magic:false,escort:0,exp:50  } },
    2:{ small:{ name:"スパイダー",      hp:30, atk:30, def:20, spd:0.055,cd:50, color:0x996633, scale:1.0, exp:20  },
        boss: { name:"ジャイアントスパイダー",hp:60,atk:60,def:40,spd:0.065,cd:40,color:0x663300,magic:false,escort:0,exp:100 } },
    3:{ small:{ name:"スネーク",        hp:40, atk:40, def:30, spd:0.055,cd:40, color:0x33aa33, scale:1.0, exp:30  },
        boss: { name:"アナコンダ",      hp:120,atk:80,def:60,spd:0.065,cd:40,color:0x006600,magic:false,escort:0,exp:200 } },
    4:{ small:{ name:"ゴブリン",        hp:50, atk:50, def:50, spd:0.055,cd:40, color:0xaacc00, scale:1.0, exp:40  },
        boss: { name:"ゴブリンメイジ",  hp:120,atk:80,def:60,spd:0.065,cd:40,color:0x556600,magic:true,magicDmg:20,escort:2,exp:220 } },
    5:{ small:{ name:"オーク",          hp:60, atk:60, def:60, spd:0.055,cd:40, color:0xcc6600, scale:1.0, exp:50  },
        boss: { name:"オークメイジ",    hp:120,atk:80,def:60,spd:0.065,cd:40,color:0x884400,magic:true,magicDmg:20,escort:2,exp:300 } },
};

const fd = FLOOR_DATA[Math.min(currentFloor,5)];

//////////////////////////////////////////////////////
// 敵生成
//////////////////////////////////////////////////////
const enemies = [];
let boss = null;

function makeEnemyMesh(data, isBoss){
    const g = new THREE.Group();
    const name = data.name;

    // ── ユーティリティ ──────────────────────────────
    function mat(color, emissive, ei){ return new THREE.MeshLambertMaterial(
        {color, emissive:emissive||0x000000, emissiveIntensity:ei||0}); }
    function mesh(geo, m){ const o=new THREE.Mesh(geo,m); o.castShadow=true; return o; }


    // ── スライム系 ──────────────────────────────────
    if(name==="スライム"||name==="ジャイアントスライム"){
        const sc  = isBoss ? 2.8 : 1.0;
        const col = isBoss ? 0x00cc00 : data.color;
        
        // 本体
        const body=mesh(new THREE.SphereGeometry(0.75*sc,16,12), mat(col,col,0.1));
        body.scale.y=0.72; 
        body.position.y=0.54*sc; 
        g.add(body);
        
        // 目（黒目のみ・左右対称）
        [-0.20*sc, 0.20*sc].forEach(ox => {
            const eye = mesh(new THREE.SphereGeometry(0.08*sc, 10, 10), mat(0x111111));
            // スライムの表面に沿うようにZ座標とY座標を調整
            eye.position.set(ox, 0.55*sc, 0.72*sc); 
            g.add(eye);
        });
        
        // 口
        const mouth=mesh(new THREE.TorusGeometry(0.12*sc, 0.03*sc, 6, 12, Math.PI), mat(0x222222));
        mouth.rotation.x=Math.PI; 
        mouth.position.set(0, 0.40*sc, 0.74*sc); 
        g.add(mouth);
        
        if(isBoss){
            const bl=new THREE.PointLight(0x00ff44,2.5,16); 
            bl.position.y=3; 
            g.add(bl);
        }
    }

    // ── スパイダー系 ────────────────────────────────
    else if(name==="スパイダー"||name==="ジャイアントスパイダー"){
        const sc  = isBoss ? 2.4 : 1.0;
        const col = isBoss ? 0x663300 : 0x996633;
        // 胴体（脚が生える胸部・半分に）
        const body=mesh(new THREE.SphereGeometry(0.28*sc,12,10),mat(col));
        body.position.y=0.75*sc; g.add(body);
        // 頭
        const head=mesh(new THREE.SphereGeometry(0.38*sc,10,8),mat(col));
        head.position.set(0,0.72*sc,0.6*sc); g.add(head);
        // 目×6（可愛く大きめ）
        [[-0.18,0.82,0.93],[0,0.9,0.95],[0.18,0.82,0.93],
         [-0.12,0.65,0.95],[0.12,0.65,0.95]].forEach(([ox,oy,oz])=>{
            const ew=mesh(new THREE.SphereGeometry(0.07*sc,6,6),mat(0xff3300,0xff1100,0.4));
            ew.position.set(ox*sc,oy*sc,oz*sc); g.add(ew);
        });
        // 牙
        [-0.1,0.1].forEach(ox=>{
            const fang=mesh(new THREE.ConeGeometry(0.05*sc,0.15*sc,5),mat(0xffffcc));
            fang.rotation.x=Math.PI/6; fang.position.set(ox*sc,0.55*sc,0.96*sc); g.add(fang);
        });
        // 脚×8（胴体中心から生やす）
        for(let i=0;i<4;i++){
            [-1,1].forEach(side=>{
                const legGroup = new THREE.Group();
                legGroup.position.set(0, 0.75*sc, 0);
                const angle = (i*0.4+0.3)*side;
                const upper=mesh(new THREE.CylinderGeometry(0.06*sc,0.05*sc,0.55*sc,6),mat(col));
                upper.rotation.z = angle;
                upper.rotation.x = -0.2;
                upper.position.set(
                    side*(0.4+i*0.05)*sc,
                    (0.1-i*0.05)*sc,
                    (i*0.1-0.1)*sc
                );
                legGroup.add(upper);
                const lower=mesh(new THREE.CylinderGeometry(0.045*sc,0.035*sc,0.5*sc,6),mat(col));
                lower.rotation.z = angle*0.6;
                lower.rotation.x = 0.8;
                lower.position.set(
                    side*(0.75+i*0.08)*sc,
                    (-0.1-i*0.06)*sc,
                    (i*0.12)*sc
                );
                legGroup.add(lower);
                g.add(legGroup);
            });
        }
        // 腹部（大きく・後ろに配置）
        const belly=mesh(new THREE.SphereGeometry(0.8*sc,12,10),mat(0xcc9944));
        belly.position.set(0,0.72*sc,-0.95*sc); g.add(belly);
        // 腹部の模様
        const pattern=mesh(new THREE.SphereGeometry(0.35*sc,8,6),mat(0xaa7722));
        pattern.scale.set(0.6,0.4,0.5);
        pattern.position.set(0,0.85*sc,-1.45*sc); g.add(pattern);
        if(isBoss){
            const bl=new THREE.PointLight(0xff4400,2.5,16); bl.position.y=3; g.add(bl);
        }
    }

    // ── スネーク系 ──────────────────────────────────
    else if(name==="スネーク"||name==="アナコンダ"){
        const sc  = isBoss ? 2.2 : 1.0;
        const col = isBoss ? 0x006600 : 0x33aa33;
        const belly = 0xddee99;
        // 胴体セグメント
        const segs=[
            {r:0.32,y:0.32,z:0},
            {r:0.30,y:0.52,z:0.22},
            {r:0.27,y:0.68,z:0.42},
            {r:0.24,y:0.78,z:0.60},
            {r:0.20,y:0.82,z:0.75},
        ];
        segs.forEach(s=>{
            const b=mesh(new THREE.SphereGeometry(s.r*sc,10,8),mat(col));
            b.position.set(0,s.y*sc,s.z*sc-0.4*sc); g.add(b);
        });
        // お腹（腹側を明るく）
        segs.forEach(s=>{
            const bv=mesh(new THREE.SphereGeometry(s.r*sc*0.7,8,6),mat(belly));
            bv.position.set(0,s.y*sc-0.05*sc,s.z*sc-0.4*sc+0.28*sc); g.add(bv);
        });
        // 尻尾（先細り・後ろへ伸びる）
        const tailSegs=[
            {r:0.17, y:0.72, z:-0.25},
            {r:0.13, y:0.60, z:-0.50},
            {r:0.09, y:0.46, z:-0.72},
            {r:0.06, y:0.32, z:-0.90},
            {r:0.03, y:0.20, z:-1.04},
        ];
        tailSegs.forEach(s=>{
            const t=mesh(new THREE.SphereGeometry(s.r*sc,8,6),mat(col));
            t.position.set(0,s.y*sc,s.z*sc); g.add(t);
        });
        // 頭
        const head=mesh(new THREE.SphereGeometry(0.38*sc,12,10),mat(col));
        head.scale.set(1,0.8,1.2); head.position.set(0,0.85*sc,0.38*sc); g.add(head);
        // 目（可愛め・丸め）
        [-0.22*sc,0.22*sc].forEach(ox=>{
            const ew=mesh(new THREE.SphereGeometry(0.1*sc,8,8),mat(0xffff00,0xaaaa00,0.3));
            ew.position.set(ox,0.92*sc,0.7*sc); g.add(ew);
            const ep=mesh(new THREE.SphereGeometry(0.05*sc,6,6),mat(0x111111));
            ep.position.set(ox,0.92*sc,0.78*sc); g.add(ep);
        });
        // 舌（二又）
        [-0.07*sc,0.07*sc].forEach(ox=>{
            const t=mesh(new THREE.CylinderGeometry(0.025*sc,0.01*sc,0.2*sc,4),mat(0xff2222));
            t.rotation.x=Math.PI/2.5; t.position.set(ox,0.8*sc,0.88*sc); g.add(t);
        });
        if(isBoss){
            const bl=new THREE.PointLight(0x00ff44,2.5,16); bl.position.y=3; g.add(bl);
        }
    }

    // ── ゴブリン系 ──────────────────────────────────
    else if(name==="ゴブリン"||name==="ゴブリンメイジ"){
        const sc=1.0;
        const skinCol=0x4a7a20;
        // 足
        [-0.22,0.22].forEach(ox=>{
            const leg=mesh(new THREE.CylinderGeometry(0.14,0.12,0.55,8),mat(0x6b4423));
            leg.position.set(ox,0.28,0); g.add(leg);
        });
        // 腰巻き
        const loin=mesh(new THREE.CylinderGeometry(0.4,0.35,0.25,10),mat(0x6b4423));
        loin.position.y=0.55; g.add(loin);
        // 胴体
        const body=mesh(new THREE.BoxGeometry(0.7,0.7,0.55),mat(skinCol));
        body.position.y=1.05; g.add(body);
        // 腕
        [-0.5,0.5].forEach(ox=>{
            const arm=mesh(new THREE.CylinderGeometry(0.1,0.09,0.55,6),mat(skinCol));
            arm.rotation.z=ox>0?-0.4:0.4;
            arm.position.set(ox,1.05,0); g.add(arm);
        });
        // 頭
        const head=mesh(new THREE.SphereGeometry(0.35,12,10),mat(skinCol));
        head.scale.set(1,1.05,1); head.position.y=1.65; g.add(head);
        // 耳（とがった耳）
        [-0.38,0.38].forEach(ox=>{
            const ear=mesh(new THREE.ConeGeometry(0.1,0.3,5),mat(skinCol));
            ear.rotation.z=ox>0?0.6:-0.6; ear.position.set(ox,1.88,0); g.add(ear);
        });
        // 目（黄色）
        [-0.14,0.14].forEach(ox=>{
            const ew=mesh(new THREE.SphereGeometry(0.08,6,6),mat(0xffee00,0xaaaa00,0.5));
            ew.position.set(ox,1.7,0.3); g.add(ew);
            const ep=mesh(new THREE.SphereGeometry(0.04,5,5),mat(0x111111));
            ep.position.set(ox,1.7,0.36); g.add(ep);
        });
        // 口（赤）と牙
        const mout=mesh(new THREE.BoxGeometry(0.28,0.08,0.05),mat(0xcc1111));
        mout.position.set(0,1.52,0.32); g.add(mout);
        [-0.08,0.08].forEach(ox=>{
            const fang=mesh(new THREE.ConeGeometry(0.04,0.12,4),mat(0xffffcc));
            fang.rotation.x=Math.PI; fang.position.set(ox,1.48,0.32); g.add(fang);
        });
        // 武器（右手）
        if(name==="ゴブリン"){
            // 錆びたショートソード
            const blade=mesh(new THREE.BoxGeometry(0.08,0.6,0.05),mat(0x886644));
            blade.position.set(0.78,1.1,0.1); blade.rotation.z=-0.3; g.add(blade);
            const guard=mesh(new THREE.BoxGeometry(0.22,0.06,0.06),mat(0x554433));
            guard.position.set(0.72,0.82,0.1); guard.rotation.z=-0.3; g.add(guard);
        } else {
            // スタッフ
            const staff=mesh(new THREE.CylinderGeometry(0.05,0.05,1.4,6),mat(0x8b6914));
            staff.position.set(0.72,1.0,0.1); staff.rotation.z=-0.15; g.add(staff);
            const orb=mesh(new THREE.SphereGeometry(0.18,8,8),mat(0xaa44ff,0x8800ff,0.8));
            orb.position.set(0.78,1.73,0.1); g.add(orb);
            const ol=new THREE.PointLight(0xaa44ff,1.5,6); ol.position.set(0.78,1.73,0.1); g.add(ol);
        }
    }

    // ── オーク系 ────────────────────────────────────
    else if(name==="オーク"||name==="オークメイジ"){
        const skinCol=0xcc7744;
        // 足（太め）
        [-0.3,0.3].forEach(ox=>{
            const leg=mesh(new THREE.CylinderGeometry(0.2,0.18,0.65,8),mat(0x885522));
            leg.position.set(ox,0.33,0); g.add(leg);
        });
        // 胴体（大きめ）
        const body=mesh(new THREE.BoxGeometry(1.1,0.9,0.72),mat(skinCol));
        body.position.y=1.12; g.add(body);
        // 腕（太い）
        [-0.68,0.68].forEach(ox=>{
            const arm=mesh(new THREE.CylinderGeometry(0.16,0.14,0.65,8),mat(skinCol));
            arm.rotation.z=ox>0?-0.35:0.35; arm.position.set(ox,1.12,0); g.add(arm);
        });
        // 頭（丸く大きめ）
        const head=mesh(new THREE.SphereGeometry(0.45,12,10),mat(skinCol));
        head.scale.set(1.1,1,1); head.position.y=1.85; g.add(head);
        // 鼻（豚鼻）
        const nose=mesh(new THREE.CylinderGeometry(0.14,0.12,0.08,8),mat(0xbb6633));
        nose.rotation.x=Math.PI/2; nose.position.set(0,1.82,0.43); g.add(nose);
        [-0.06,0.06].forEach(ox=>{
            const nostril=mesh(new THREE.SphereGeometry(0.04,5,5),mat(0x552200));
            nostril.position.set(ox,1.82,0.49); g.add(nostril);
        });
        // 目（小さく鋭い）
        [-0.18,0.18].forEach(ox=>{
            const ew=mesh(new THREE.SphereGeometry(0.09,6,6),mat(0xffcc00,0xaaaa00,0.3));
            ew.position.set(ox,1.98,0.36); g.add(ew);
            const ep=mesh(new THREE.SphereGeometry(0.05,5,5),mat(0x111111));
            ep.position.set(ox,1.98,0.43); g.add(ep);
        });
        // 牙
        [-0.12,0.12].forEach(ox=>{
            const fang=mesh(new THREE.ConeGeometry(0.06,0.18,4),mat(0xffffee));
            fang.rotation.x=Math.PI; fang.position.set(ox,1.68,0.38); g.add(fang);
        });
        // 耳（大きい横長）
        [-0.52,0.52].forEach(ox=>{
            const ear=mesh(new THREE.SphereGeometry(0.14,8,6),mat(skinCol));
            ear.scale.set(0.5,1,0.6); ear.position.set(ox,1.9,0); g.add(ear);
        });
        // 武器（右手）
        if(name==="オーク"){
            // 錆びたショートソード（大きめ）
            const blade=mesh(new THREE.BoxGeometry(0.11,0.75,0.06),mat(0x887755));
            blade.position.set(0.9,1.15,0.1); blade.rotation.z=-0.3; g.add(blade);
            const guard=mesh(new THREE.BoxGeometry(0.28,0.07,0.07),mat(0x664433));
            guard.position.set(0.84,0.82,0.1); guard.rotation.z=-0.3; g.add(guard);
        } else {
            // スタッフ
            const staff=mesh(new THREE.CylinderGeometry(0.06,0.06,1.6,6),mat(0x8b6914));
            staff.position.set(0.88,1.1,0.1); staff.rotation.z=-0.15; g.add(staff);
            const orb=mesh(new THREE.SphereGeometry(0.22,8,8),mat(0xff6600,0xcc3300,0.8));
            orb.position.set(0.95,1.92,0.1); g.add(orb);
            const ol=new THREE.PointLight(0xff6600,1.5,6); ol.position.set(0.95,1.92,0.1); g.add(ol);
        }
        // ボスライト
        if(isBoss){
            const bl=new THREE.PointLight(0xff4400,2.5,16); bl.position.y=3; g.add(bl);
        }
    }

    // ── フォールバック ──────────────────────────────
    else {
        const b=mesh(new THREE.BoxGeometry(1,2,1),mat(data.color));
        b.position.y=1; g.add(b);
    }

    return g;
}

function createEnemy(wx,wz,data,isBoss){
    const m=makeEnemyMesh(data,isBoss);
    // ボスはモデルをスケールアップ（スライム以外）
    if(isBoss && data.name!=="ジャイアントスライム"){
        m.scale.set(1.8,1.8,1.8);
    }
    m.position.set(wx,0,wz);
    m.userData.hp       = data.hp;
    m.userData.maxHp    = data.hp;
    m.userData.atk      = data.atk;
    m.userData.def      = data.def;
    m.userData.spd      = data.spd;
    m.userData.cdMax    = data.cd;
    m.userData.cooldown = Math.floor(Math.random()*data.cd);
    m.userData.isEnemy  = true;
    m.userData.isBoss   = isBoss;
    m.userData.name     = data.name;
    m.userData.magic    = isBoss && data.magic;
    m.userData.magicDmg = isBoss && data.magic ? data.magicDmg : 0;
    m.userData.magicCd  = 0;
    m.userData.exp      = data.exp || 0;
    scene.add(m);
    enemies.push(m);
    return m;
}

// スライム5グループ×3匹
const slimeColors=[0xff3333,0x33cc66,0x3388ff,0xffaa00,0xff44cc];
slimeRooms.forEach((room,gi)=>{
    const color=slimeColors[gi%slimeColors.length];
    const sdata={...fd.small,color};
    for(let i=0;i<3;i++){
        let tx,tz,tries=0;
        do{ tx=room.x+1+Math.floor(Math.random()*(room.w-2));
            tz=room.z+1+Math.floor(Math.random()*(room.h-2)); tries++;
        }while(!isWalkable(tx,tz)&&tries<30);
        createEnemy(tx*TILE,tz*TILE,sdata,false);
    }
});
const TOTAL_SLIMES = enemies.length;

// セーブ・ロード時：撃破済みスライムを除去して状態を復元
let slimesKilled = 0;
if(savedSlimesKilled > 0){
    // 撃破数分だけランダムに除去（グループ単位で消す）
    let toRemove = Math.min(savedSlimesKilled, enemies.length);
    for(let i=0; i<toRemove; i++){
        const e = enemies.shift();
        scene.remove(e);
        slimesKilled++;
    }
}
// ボス出現済みならすぐ出現させる
if(savedBossSpawned){ spawnBoss(); }
enemyText.textContent = enemies.length;

function spawnBoss(){
    const bd=fd.boss;
    const b=createEnemy(bossRoom.cx*TILE,bossRoom.cz*TILE,bd,true);
    boss=b;
    // お供
    if(bd.escort>0){
        for(let i=0;i<bd.escort;i++){
            const ox=(i===0?-3:3),oz=0;
            const esc=createEnemy(bossRoom.cx*TILE+ox,bossRoom.cz*TILE+oz,fd.small,false);
            esc.userData.isEscort=true;
        }
    }
    enemyText.textContent=enemies.length;
    showMessage("💀 " + bd.name + " 出現！");
}

//////////////////////////////////////////////////////
// ショップシステム
//////////////////////////////////////////////////////
const shopScreenEl = document.getElementById("shopScreen");

function openShop(){
    if(!gameStarted||gameOver) return;
    inShop=true;
    document.getElementById("shopGoldText").textContent=playerGold;
    renderShopTab(activeTab);
    shopScreenEl.style.display="flex";
}
function closeShop(){
    inShop=false;
    shopScreenEl.style.display="none";
}

function renderShopTab(tab){
    activeTab=tab;
    document.querySelectorAll(".shop-tab").forEach(btn=>{
        btn.classList.toggle("active", btn.dataset.tab===tab);
    });
    const container=document.getElementById("shopItems");
    container.innerHTML="";
    Object.values(ITEMS).filter(it=>it.tab===tab).forEach(item=>{
        const div=document.createElement("div");
        div.className="shop-item";
        const isWeapon = item.tab==="weapon";
        const isArmor  = item.tab==="armor";
        const isEquipped=(isWeapon&&equippedWeapon===item.id)||(isArmor&&equippedArmor===item.id);
        const canBuy=playerGold>=item.price;
        div.innerHTML=`
          <div class="shop-item-info">
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.desc}</div>
            ${isEquipped?'<div class="shop-item-equipped">✅ 装備中</div>':''}
          </div>
          <button class="shop-buy-btn" ${canBuy?'':'disabled'}>
            💰${item.price}G
          </button>`;
        div.querySelector("button").addEventListener("click",()=>buyItem(item));
        container.appendChild(div);
    });
}

let activeTab = "weapon";

function buyItem(item){
    if(playerGold<item.price){ showMessage("ゴールドが足りない！"); return; }
    playerGold -= item.price;
    if(item.effect==="hp"){
        hpPotCount++;
        showMessage("HP回復薬を買った！ 💊 (×"+hpPotCount+")");
    } else if(item.effect==="mp"){
        mpPotCount++;
        showMessage("MP回復薬を買った！ 💧 (×"+mpPotCount+")");
    } else if(item.tab==="weapon"){
        equippedWeapon=item.id;
        showMessage(item.name+"を装備した！ ⚔️");
    } else if(item.tab==="armor"){
        equippedArmor=item.id;
        showMessage(item.name+"を装備した！ 🛡️");
    }
    updateUI();
    renderShopTab(activeTab);
}

document.querySelectorAll(".shop-tab").forEach(btn=>{
    btn.addEventListener("click",()=>renderShopTab(btn.dataset.tab));
});
document.getElementById("shopCloseBtn").addEventListener("click",closeShop);

//////////////////////////////////////////////////////
// セーブ・ロード（localStorage）
//////////////////////////////////////////////////////
const SAVE_KEY = "dungeonQuest_save";

function saveGame(){
    const data = {
        floor:        currentFloor,
        lv:           playerLevel,
        hp:           Math.ceil(playerHP),
        maxHp:        playerMaxHP,
        mp:           Math.ceil(playerMP),
        maxMp:        playerMaxMP,
        exp:          playerEXP,
        gold:         playerGold,
        hppot:        hpPotCount,
        mppot:        mpPotCount,
        weapon:       equippedWeapon || "",
        armor:        equippedArmor  || "",
        vit:          statVit,
        atk:          statAtk,
        def:          statDef,
        int:          statInt,
        agi:          statAgi,
        spt:          statPoints,
        killed:       slimesKilled,
        boss:         boss ? "1" : "0",
        savedAt:      new Date().toLocaleString("ja-JP"),
    };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        showMessage("💾 セーブしました！ (" + data.savedAt + ")");
    } catch(e) {
        showMessage("⚠️ セーブに失敗しました");
    }
}

function loadGame(){
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if(!raw){ showMessage("📂 セーブデータがありません"); return; }
        const data = JSON.parse(raw);
        // 確認ダイアログ
        const ok = confirm(
            "セーブデータをロードしますか？\n\n" +
            "📅 " + (data.savedAt||"不明") + "\n" +
            "🏰 " + (data.floor||1) + "F　" +
            "Lv." + (data.lv||1) + "\n" +
            "💰 " + (data.gold||0) + "G　" +
            "⚔️ " + (data.weapon||"なし") + "\n\n" +
            "現在の進行状況は失われます。"
        );
        if(!ok) return;
        const session = {
            floor:  data.floor  || 1,
            lv:     data.lv     || 1,
            hp:     data.hp     || 100,
            mp:     data.mp     || 50,
            exp:    data.exp    || 0,
            gold:   data.gold   || 50,
            hppot:  data.hppot  || 0,
            mppot:  data.mppot  || 0,
            wpn:    data.weapon || "knife",
            arm:    data.armor  || "cloth",
            vit:    data.vit    || 1,
            atk:    data.atk    || 1,
            def:    data.def    || 1,
            int:    data.int    || 1,
            agi:    data.agi    || 1,
            spt:    data.spt    || 0,
            killed: data.killed || 0,
            boss:   data.boss   || 0,
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        sessionStorage.setItem(SESSION_KEY + "_from_transfer", "1");
        location.href = location.href.split("?")[0];
    } catch(e) {
        showMessage("⚠️ ロードに失敗しました");
    }
}

document.getElementById("shopSaveBtn").addEventListener("click", saveGame);
document.getElementById("shopLoadBtn").addEventListener("click", loadGame);

//////////////////////////////////////////////////////
// カメラオフセット
//////////////////////////////////////////////////////
const cameraOffset=new THREE.Vector3(0,14,20);
const camLookAt=new THREE.Vector3();

//////////////////////////////////////////////////////
// ミニマップ
//////////////////////////////////////////////////////
function drawMinimap(){
    const cw=MM/MAP_W,ch=MM/MAP_H;
    minimapCtx.fillStyle="#080810";
    minimapCtx.fillRect(0,0,MM,MM);
    for(let z=0;z<MAP_H;z++){
        for(let x=0;x<MAP_W;x++){
            const t=mapData[z][x];
            if(t===1)      minimapCtx.fillStyle="rgba(110,85,55,0.95)";
            else if(t===2) minimapCtx.fillStyle="rgba(75,58,38,0.8)";
            else if(t===3) minimapCtx.fillStyle="rgba(30,80,120,0.95)";
            else continue;
            minimapCtx.fillRect(x*cw,z*ch,cw+0.5,ch+0.5);
        }
    }
    for(let e of enemies){
        const ex=(e.position.x/TILE)*cw, ez=(e.position.z/TILE)*ch;
        minimapCtx.fillStyle=e.userData.isBoss?"#c084fc":"#f87171";
        minimapCtx.beginPath();
        minimapCtx.arc(ex,ez,e.userData.isBoss?cw*2.5:cw*1.2,0,Math.PI*2);
        minimapCtx.fill();
    }
    // 階段
    if(stairsVisible && stairsMesh){
        const sx=(stairsMesh.position.x/TILE)*cw, sz=(stairsMesh.position.z/TILE)*ch;
        // 外枠（黒）
        minimapCtx.fillStyle="#000";
        minimapCtx.beginPath();
        minimapCtx.arc(sx,sz,cw*2.8,0,Math.PI*2);
        minimapCtx.fill();
        // 金色アイコン
        minimapCtx.fillStyle="#ffd700";
        minimapCtx.beginPath();
        minimapCtx.arc(sx,sz,cw*2.2,0,Math.PI*2);
        minimapCtx.fill();
        // 中央に🪜の代わりに白い▲
        minimapCtx.fillStyle="#fff";
        minimapCtx.font = "bold " + Math.floor(cw*3) + "px sans-serif";
        minimapCtx.textAlign="center";
        minimapCtx.textBaseline="middle";
        minimapCtx.fillText("↑", sx, sz);
    }
    const px=(player.position.x/TILE)*cw, pz=(player.position.z/TILE)*ch;
    minimapCtx.fillStyle="#60a5fa";
    minimapCtx.beginPath();
    minimapCtx.arc(px,pz,cw*1.8,0,Math.PI*2);
    minimapCtx.fill();
    minimapCtx.strokeStyle="#fff"; minimapCtx.lineWidth=0.5; minimapCtx.stroke();
}

//////////////////////////////////////////////////////
// 入力
//////////////////////////////////////////////////////
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
let targetPosition=player.position.clone();
let moving=false,touchStartX=0,touchStartY=0,holdTimer=null,isHolding=false;

const chargeEl=document.createElement("div");
chargeEl.id="chargeIndicator"; chargeEl.textContent="🔥 魔法詠唱中…";
document.getElementById("gameUI").appendChild(chargeEl);

function isGameCanvas(target){
    // canvas以外（ボタン・div等のUI要素）はゲーム入力として扱わない
    return target === renderer.domElement;
}

function onTouchStart(event){
    if(!gameStarted||gameOver||inShop||stairsUIOpen) return;
    if(!isGameCanvas(event.target)) return;
    const touch=event.touches?event.touches[0]:event;
    touchStartX=touch.clientX; touchStartY=touch.clientY; isHolding=false;
}

function onTouchEnd(event){
    if(!gameStarted||gameOver||inShop||stairsUIOpen) return;
    if(!isGameCanvas(event.target)) return;
    const touch=event.changedTouches?event.changedTouches[0]:event;
    const dx=touch.clientX-touchStartX, dy=touch.clientY-touchStartY;
    // 右フリック→魔法、左フリック→回転斬り
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5){
        if(dx > 0) castMagic();
        else       specialAttack();
        return;
    }

    mouse.x=(touch.clientX/window.innerWidth)*2-1;
    mouse.y=-(touch.clientY/window.innerHeight)*2+1;
    raycaster.setFromCamera(mouse,camera);
    const hits=raycaster.intersectObjects(scene.children,true);

    // ショップ看板タップ
    for(let h of hits){
        if(h.object===shopSign){ openShop(); return; }
    }
    // 敵タップ
    for(let h of hits){
        let o=h.object;
        while(o&&o!==scene){ if(o.userData.isEnemy){ attackEnemy(o); return; } o=o.parent; }
    }
    // 床タップ→移動
    for(let h of hits){
        if(h.object.userData.walkable){
            targetPosition.set(h.object.position.x,0,h.object.position.z);
            moving=true; return;
        }
    }
}

window.addEventListener("touchstart",onTouchStart,{passive:false});
window.addEventListener("mousedown",onTouchStart);
window.addEventListener("touchend",onTouchEnd);
window.addEventListener("mouseup",onTouchEnd);

//////////////////////////////////////////////////////
// 通常攻撃
//////////////////////////////////////////////////////
function attackEnemy(enemyObj){
    if(attacking||attackCooldown>0) return;
    attacking=true;
    player.lookAt(enemyObj.position.x,0,enemyObj.position.z);
    swordMesh.rotation.z=-2;
    setTimeout(()=>{ swordMesh.rotation.z=0; },150);

    if(player.position.distanceTo(enemyObj.position)<5){
        const dmg=calcDamage(getATK(),enemyObj.userData.def);
        enemyObj.userData.hp-=dmg;
        showMessage("斬撃！ -"+dmg+" ⚔️");
        flashEnemy(enemyObj);
        if(enemyObj.userData.hp<=0) killEnemy(enemyObj);
    }
    attackCooldown = getAGIFrames();
    setTimeout(()=>{ attacking=false; },200);
}

function flashEnemy(e){
    e.traverse(c=>{ if(c.isMesh){ c._oc=c.material.color.getHex(); c.material.color.set(0xffffff); } });
    setTimeout(()=>{ e.traverse(c=>{ if(c.isMesh&&c._oc!==undefined) c.material.color.setHex(c._oc); }); },120);
}

//////////////////////////////////////////////////////
// 回転斬り（ATK×3 総ダメージを均等に分割）
//////////////////////////////////////////////////////
function specialAttack(){
    if(attacking) return;
    attacking=true;
    showMessage("⚡ 回転斬り！");
    const hitSet=new Set();
    let spin=0;
    const iv=setInterval(()=>{
        player.rotation.y+=0.4; spin+=0.4;
        for(let i=enemies.length-1;i>=0;i--){
            const e=enemies[i];
            if(player.position.distanceTo(e.position)<5.5&&!hitSet.has(e)){
                hitSet.add(e);
                // ATK×3を被ヒット数で均等割り
                const totalDmg = calcDamage(getATK()*3, e.userData.def);
                const perHit   = Math.max(1, Math.floor(totalDmg/8));
                e.userData.hp -= perHit;
                if(e.userData.hp<=0) killEnemy(e);
            }
        }
        if(spin>Math.PI*2){ clearInterval(iv); attacking=false; }
    },30);
}

//////////////////////////////////////////////////////
// 魔法（ファイヤー、ダメージ20固定、MP20消費）
//////////////////////////////////////////////////////
const fireballs=[];
function castMagic(){
    if(playerMP<20){ showMessage("MPが足りない！ 💧"); return; }
    if(enemies.length===0) return;
    playerMP-=20; updateUI();
    showMessage("🔥 ファイヤー！");
    let target=null,md=Infinity;
    for(let e of enemies){ const d=player.position.distanceTo(e.position); if(d<md){md=d;target=e;} }
    if(!target) return;
    const fb=new THREE.Mesh(new THREE.SphereGeometry(0.35,8,8),
        new THREE.MeshLambertMaterial({color:0xff6600,emissive:0xff3300,emissiveIntensity:0.9}));
    fb.position.set(player.position.x,1.5,player.position.z);
    scene.add(fb);
    fb.add(new THREE.PointLight(0xff4400,2.5,10));
    fireballs.push({ball:fb,target});
}

function updateFireballs(){
    for(let i=fireballs.length-1;i>=0;i--){
        const fb=fireballs[i];
        if(!fb.ball.parent){ fireballs.splice(i,1); continue; }
        const dir=new THREE.Vector3();
        dir.subVectors(fb.target.position,fb.ball.position); dir.y=0;
        const dist=dir.length();
        if(dist<1.5){
            // 敵に命中
            const dmg = getMagicDmg();
            fb.target.userData.hp-=dmg;
            showMessage("🔥 炎の一撃！ -"+dmg);
            spawnExplosion(fb.ball.position.clone());
            scene.remove(fb.ball);
            if(fb.target.userData.hp<=0) killEnemy(fb.target);
            fireballs.splice(i,1);
        } else {
            dir.normalize();
            const nx=fb.ball.position.x+dir.x*0.3;
            const nz=fb.ball.position.z+dir.z*0.3;
            // 壁衝突チェック
            const tx=Math.round(nx/TILE), tz=Math.round(nz/TILE);
            if(!isWalkable(tx,tz)){
                // 壁に当たったら爆発して消える
                spawnExplosion(fb.ball.position.clone());
                scene.remove(fb.ball);
                fireballs.splice(i,1);
                continue;
            }
            fb.ball.position.x=nx; fb.ball.position.z=nz;
            fb.ball.position.y=1.5+Math.sin(Date.now()*0.01)*0.15;
            if(dist>150){ scene.remove(fb.ball); fireballs.splice(i,1); }
        }
    }
}

//////////////////////////////////////////////////////
// 爆発エフェクト
//////////////////////////////////////////////////////
const particles=[];
function spawnExplosion(pos){
    for(let i=0;i<14;i++){
        const p=new THREE.Mesh(new THREE.SphereGeometry(0.15,4,4),
            new THREE.MeshLambertMaterial({color:0xff4400,emissive:0xff2200,emissiveIntensity:1}));
        p.position.copy(pos);
        const v=new THREE.Vector3((Math.random()-0.5)*0.35,Math.random()*0.4,(Math.random()-0.5)*0.35);
        scene.add(p); particles.push({mesh:p,vel:v,life:24});
    }
}
function updateParticles(){
    for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        p.mesh.position.addScaledVector(p.vel,1); p.vel.y-=0.025; p.life--;
        p.mesh.material.opacity=p.life/24;
        if(p.life<=0){ scene.remove(p.mesh); particles.splice(i,1); }
    }
}

//////////////////////////////////////////////////////
// 階段オブジェクト
//////////////////////////////////////////////////////
let stairsMesh = null;
let stairsVisible = false;

function spawnStairs(){
    if(stairsMesh) scene.remove(stairsMesh);
    const geo = new THREE.CylinderGeometry(1.2, 1.5, 0.4, 8);
    const mat = new THREE.MeshLambertMaterial({color:0xffd700, emissive:0xaa8800, emissiveIntensity:0.6});
    stairsMesh = new THREE.Mesh(geo, mat);
    stairsMesh.position.set(bossRoom.cx*TILE, 0.2, bossRoom.cz*TILE);
    scene.add(stairsMesh);
    // 金色の光
    const sl = new THREE.PointLight(0xffd700, 3, 12);
    sl.position.set(0, 2, 0);
    stairsMesh.add(sl);
    stairsVisible = true;
    showMessage("✨ 階段が現れた！");
}

// 階段選択UI
let stairsUIOpen = false;
function openStairsUI(){
    if(stairsUIOpen) return;
    stairsUIOpen = true;
    const overlay = document.createElement("div");
    overlay.id = "stairsUI";
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:70;display:flex;align-items:center;
        justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);`;
    const box = document.createElement("div");
    box.style.cssText = `
        background:linear-gradient(160deg,#1e1a2e,#0f0d1a);border:1px solid rgba(255,215,0,0.4);
        border-radius:16px;padding:28px 32px;text-align:center;
        box-shadow:0 0 40px rgba(255,215,0,0.2);`;
    box.innerHTML = `
        <div style="font-size:32px;margin-bottom:8px;">🪜</div>
        <div style="font-family:'Cinzel',serif;font-size:20px;color:#ffd700;
            letter-spacing:3px;margin-bottom:6px;">${currentFloor}F　階段</div>
        <div style="font-size:12px;color:#9ca3af;margin-bottom:20px;letter-spacing:1px;">どうしますか？</div>`;

    const btnStyle = `display:block;width:100%;padding:14px;margin-bottom:10px;
        border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;
        letter-spacing:1px;border:none;transition:all 0.15s;text-align:left;padding-left:20px;`;

    // 上がるボタン（最終階では非表示）
    if(currentFloor < 5){
        const upBtn = document.createElement("button");
        upBtn.innerHTML = "⬆️ &nbsp;次の階へ進む（" + (currentFloor+1) + "F）";
        upBtn.style.cssText = btnStyle + "background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;";
        upBtn.onclick = ()=>{ closeStairsUI(); changeFloor(currentFloor+1); };
        box.appendChild(upBtn);
    }

    const retryBtn = document.createElement("button");
    retryBtn.innerHTML = "🔄 &nbsp;この階をはじめからやる（" + currentFloor + "F）";
    retryBtn.style.cssText = btnStyle + "background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.5)!important;color:#fbbf24;";
    retryBtn.onclick = ()=>{ closeStairsUI(); changeFloor(currentFloor); };
    box.appendChild(retryBtn);

    // 下がるボタン（1階では非表示）
    if(currentFloor > 1){
        const downBtn = document.createElement("button");
        downBtn.innerHTML = "⬇️ &nbsp;前の階に戻る（" + (currentFloor-1) + "F）";
        downBtn.style.cssText = btnStyle + "background:rgba(255,255,255,0.06);color:#9ca3af;border:1px solid rgba(255,255,255,0.1)!important;margin-bottom:0;";
        downBtn.onclick = ()=>{ closeStairsUI(); changeFloor(currentFloor-1); };
        box.appendChild(downBtn);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

function closeStairsUI(){
    stairsUIOpen = false;
    const el = document.getElementById("stairsUI");
    if(el) el.remove();
}

//////////////////////////////////////////////////////
// 階移動
//////////////////////////////////////////////////////
function buildSessionData(floor, killed, bossSpawned){
    return {
        floor:  floor,
        lv:     playerLevel,
        hp:     Math.ceil(playerHP),
        mp:     Math.ceil(playerMP),
        exp:    playerEXP,
        gold:   playerGold,
        hppot:  hpPotCount,
        mppot:  mpPotCount,
        wpn:    equippedWeapon || "knife",
        arm:    equippedArmor  || "cloth",
        vit:    statVit,
        atk:    statAtk,
        def:    statDef,
        int:    statInt,
        agi:    statAgi,
        spt:    statPoints,
        killed: killed || 0,
        boss:   bossSpawned ? 1 : 0,
    };
}

function changeFloor(newFloor){
    const data = buildSessionData(newFloor, 0, false);
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
        sessionStorage.setItem(SESSION_KEY + "_from_transfer", "1");
    } catch(e){}
    location.href = location.href.split("?")[0];
}

//////////////////////////////////////////////////////
// 敵撃破
//////////////////////////////////////////////////////
function killEnemy(enemy){
    if(!enemy.parent) return;
    scene.remove(enemy);
    const idx=enemies.indexOf(enemy);
    if(idx>=0) enemies.splice(idx,1);

    const gold = enemy.userData.isBoss
        ? 30 + currentFloor*10
        : 5  + currentFloor*2;
    playerGold += gold;
    const exp = enemy.userData.exp || 0;

    if(enemy.userData.isBoss){
        showMessage(enemy.userData.name+" 撃破！ 💰"+gold+"G EXP+"+exp+" 🏆");
        boss = null;
        gainEXP(exp);
        if(currentFloor >= 5){
            setTimeout(()=>{ triggerClear(); }, 2000);
        } else {
            spawnStairs();
        }
    } else {
        slimesKilled++;
        showMessage(enemy.userData.name+" 撃破！ 💰"+gold+"G EXP+"+exp+" ("+slimesKilled+"/"+TOTAL_SLIMES+")");
        gainEXP(exp);
        if(enemies.length===0 && boss===null) spawnBoss();
    }
    updateUI();
    enemyText.textContent = enemies.length;
}

//////////////////////////////////////////////////////
// 衝突判定ヘルパー（半径を持たせたAABBチェック）
//////////////////////////////////////////////////////
function canMove(nx, nz, radius){
    // キャラクターの四隅をチェック
    const r = radius;
    const corners = [
        [nx-r, nz-r],
        [nx+r, nz-r],
        [nx-r, nz+r],
        [nx+r, nz+r],
    ];
    for(let [cx,cz] of corners){
        const tx = Math.floor(cx/TILE + 0.5);
        const tz = Math.floor(cz/TILE + 0.5);
        if(!isWalkable(tx, tz)) return false;
    }
    return true;
}

//////////////////////////////////////////////////////
// プレイヤー移動
//////////////////////////////////////////////////////
function updatePlayer(){
    if(attackCooldown>0) attackCooldown--;
    if(!moving) return;
    const dir=new THREE.Vector3();
    dir.subVectors(targetPosition,player.position);
    if(dir.length()<0.15){ moving=false; return; }
    dir.normalize();
    const SPEED=0.15;
    const nx=player.position.x+dir.x*SPEED;
    const nz=player.position.z+dir.z*SPEED;

    // X軸・Z軸を個別にチェックして壁すべりを実現
    const PLAYER_R = 0.6;
    const canX = canMove(nx, player.position.z, PLAYER_R);
    const canZ = canMove(player.position.x, nz, PLAYER_R);

    if(canX || canZ){
        let bx = canX ? nx : player.position.x;
        let bz = canZ ? nz : player.position.z;

        // 敵との衝突
        let blocked=false;
        for(let e of enemies){
            const d=Math.hypot(bx-e.position.x,bz-e.position.z);
            if((e.userData.isBoss&&d<3.5)||(!e.userData.isBoss&&d<1.8)){blocked=true;break;}
        }
        if(!blocked){
            player.position.x = bx;
            player.position.z = bz;
        }
    }
    player.rotation.y=Math.atan2(targetPosition.x-player.position.x,targetPosition.z-player.position.z);

    // ショップ近接で案内
    if(isShopRoom(player.position.x,player.position.z)){
        const dist=Math.hypot(player.position.x-shopRoom.cx*TILE,player.position.z-shopRoom.cz*TILE);
        if(dist<TILE*2) showMessage("🏪 看板をタップでショップ！");
    }

    // 階段近接で選択UI
    if(stairsVisible && stairsMesh && !stairsUIOpen){
        const sd=Math.hypot(player.position.x-stairsMesh.position.x,
                            player.position.z-stairsMesh.position.z);
        if(sd < TILE*1.5) openStairsUI();
    }
}

//////////////////////////////////////////////////////
// 敵AI
//////////////////////////////////////////////////////
function updateEnemies(){
    for(let enemy of enemies){
        if(enemy.userData.cooldown>0) enemy.userData.cooldown--;

        // ショップ部屋には入れない
        if(isShopRoom(enemy.position.x,enemy.position.z)){
            // 追い出す（スタート部屋方向へ押し戻す）
            const pushDir=new THREE.Vector3(startRoom.cx*TILE-enemy.position.x,0,startRoom.cz*TILE-enemy.position.z).normalize();
            enemy.position.x+=pushDir.x*0.1;
            enemy.position.z+=pushDir.z*0.1;
            continue;
        }

        const dir=new THREE.Vector3();
        dir.subVectors(player.position,enemy.position);
        const dist=dir.length();
        enemy.lookAt(player.position.x,0,player.position.z);

        const detectRange=enemy.userData.isBoss?999:22;
        const stopDist=enemy.userData.isBoss?3.5:2.0;

        if(dist>stopDist&&dist<detectRange){
            dir.normalize();
            const spd=enemy.userData.spd;
            const nx=enemy.position.x+dir.x*spd;
            const nz=enemy.position.z+dir.z*spd;
            const eRadius = enemy.userData.isBoss ? 1.4 : 0.7;

            // X・Z軸個別チェックで壁すべり
            const canX = canMove(nx, enemy.position.z, eRadius) && !isShopRoom(nx, enemy.position.z);
            const canZ = canMove(enemy.position.x, nz, eRadius) && !isShopRoom(enemy.position.x, nz);
            if(canX) enemy.position.x = nx;
            if(canZ) enemy.position.z = nz;
        } else if(dist<=stopDist&&enemy.userData.cooldown<=0){
            const dmg=calcDamage(enemy.userData.atk,getDEF());
            playerHP-=dmg;
            if(playerHP<0) playerHP=0;
            updateUI();
            showMessage(enemy.userData.name+"の攻撃！ -"+dmg);
            bodyMesh.material.color.set(0xff0000);
            setTimeout(()=>{ bodyMesh.material.color.set(0x3399ff); },150);
            enemy.userData.cooldown=enemy.userData.cdMax;
            if(playerHP<=0) triggerGameover();
        }

        // ボスの魔法攻撃
        if(enemy.userData.magic&&enemy.userData.isBoss){
            enemy.userData.magicCd=(enemy.userData.magicCd||0)+1;
            if(enemy.userData.magicCd>=120&&dist<30){
                enemy.userData.magicCd=0;
                const mdmg=calcDamage(enemy.userData.magicDmg,getDEF()*0.5|0);
                playerHP-=mdmg;
                if(playerHP<0) playerHP=0;
                updateUI();
                showMessage("💥 魔法攻撃！ -"+mdmg);
                spawnExplosion(new THREE.Vector3(player.position.x,1,player.position.z));
                if(playerHP<=0) triggerGameover();
            }
        }
    }
}

//////////////////////////////////////////////////////
// MP自動回復
//////////////////////////////////////////////////////
let mpRegenTimer=0;
function updateMPRegen(){
    mpRegenTimer++;
    if(mpRegenTimer>=120){
        if(playerMP<playerMaxMP){ playerMP=Math.min(playerMP+1,playerMaxMP); updateUI(); }
        mpRegenTimer=0;
    }
}

//////////////////////////////////////////////////////
// カメラ
//////////////////////////////////////////////////////
function updateCamera(){
    const BOSS_NEAR=18,BOSS_FULL=10;
    let bossBlend=0;
    if(boss&&boss.parent){
        const d=player.position.distanceTo(boss.position);
        if(d < BOSS_NEAR){
            // 視線チェック：プレイヤー→ボスの間に壁がないか
            const origin = new THREE.Vector3(player.position.x, 1.5, player.position.z);
            const dir    = new THREE.Vector3();
            dir.subVectors(boss.position, origin).normalize();
            const ray    = new THREE.Raycaster(origin, dir, 0, d);
            const hits   = ray.intersectObjects(scene.children, false);
            // 壁（BoxGeometry = walkableでない）に当たっていないか確認
            const blocked = hits.some(h => h.object.userData.walkable === undefined && !h.object.userData.isEnemy);
            if(!blocked){
                bossBlend=1-Math.min(1,Math.max(0,(d-BOSS_FULL)/(BOSS_NEAR-BOSS_FULL)));
            }
        }
    }
    const normalCamPos=new THREE.Vector3(
        player.position.x+cameraOffset.x,player.position.y+cameraOffset.y,player.position.z+cameraOffset.z);
    const normalLookAt=new THREE.Vector3(player.position.x,0,player.position.z);
    let targetCamPos,targetLookAt;
    if(bossBlend>0&&boss&&boss.parent){
        const toBoss=new THREE.Vector3();
        toBoss.subVectors(boss.position,player.position).normalize();
        const bossCamPos=new THREE.Vector3(
            player.position.x-toBoss.x*6,player.position.y+2.2,player.position.z-toBoss.z*6);
        const bossLookAt=new THREE.Vector3(boss.position.x,boss.position.y+3.5,boss.position.z);
        targetCamPos=normalCamPos.clone().lerp(bossCamPos,bossBlend);
        targetLookAt=normalLookAt.clone().lerp(bossLookAt,bossBlend);
    } else {
        targetCamPos=normalCamPos; targetLookAt=normalLookAt;
    }
    camera.position.lerp(targetCamPos,0.06);
    camLookAt.lerp(targetLookAt,0.06);
    camera.lookAt(camLookAt);
}

//////////////////////////////////////////////////////
// ゲームオーバー / クリア
//////////////////////////////////////////////////////
function triggerGameover(){
    if(gameOver||gameCleared) return;
    gameOver=true; gameStarted=false;
    setTimeout(()=>{
        document.getElementById("gameoverStats").innerHTML=
            "Lv."+playerLevel+" &nbsp;|&nbsp; "+currentFloor+"階 &nbsp;|&nbsp; 残敵："+enemies.length+"体";
        document.getElementById("gameoverScreen").style.display="flex";
        gameUI.style.display="none";
    },1000);
}
function triggerClear(){
    if(gameCleared) return;
    gameCleared=true; gameStarted=false;
    document.getElementById("clearStats").innerHTML=
        "Lv."+playerLevel+" &nbsp;|&nbsp; "+currentFloor+"階クリア！ 🎉<br>💰"+playerGold+"G";
    document.getElementById("clearScreen").style.display="flex";
    gameUI.style.display="none";
}

document.getElementById("retryBtn").addEventListener("click",()=>{ location.reload(); });
document.getElementById("clearRetryBtn").addEventListener("click",()=>{ location.reload(); });
document.getElementById("startBtn").addEventListener("click", startGame);

// セーブデータがあれば「続きから」ボタンを表示
(function checkSaveData(){
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if(!raw) return;
        const data = JSON.parse(raw);
        const btn  = document.getElementById("continueBtn");
        const info = document.getElementById("saveInfo");
        btn.style.display = "block";
        info.textContent  =
            (data.savedAt||"") + "　" +
            (data.floor||1) + "F　Lv." + (data.lv||1) +
            "　💰" + (data.gold||0) + "G";
        btn.addEventListener("click", ()=>{ loadAndStart(data); });
    } catch(e){}
})();

function loadAndStart(data){
    const session = {
        floor:  data.floor  || 1,
        lv:     data.lv     || 1,
        hp:     data.hp     || 100,
        mp:     data.mp     || 50,
        exp:    data.exp    || 0,
        gold:   data.gold   || 50,
        hppot:  data.hppot  || 0,
        mppot:  data.mppot  || 0,
        wpn:    data.weapon || "knife",
        arm:    data.armor  || "cloth",
        vit:    data.vit    || 1,
        atk:    data.atk    || 1,
        def:    data.def    || 1,
        int:    data.int    || 1,
        agi:    data.agi    || 1,
        spt:    data.spt    || 0,
        killed: data.killed || 0,
        boss:   data.boss   || 0,
    };
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
        sessionStorage.setItem(SESSION_KEY + "_from_transfer", "1");
    } catch(e){}
    location.href = location.href.split("?")[0];
}

function startGame(){
    document.getElementById("titleScreen").style.display="none";
    gameUI.style.display="block";
    gameStarted=true;
    recalcStats();
    // sessionStorageから読み込んだ場合はHP/MPをそのまま使う（新規のみ全回復）
    const isNewGame = !sessionStorage.getItem(SESSION_KEY + "_loaded");
    if(isNewGame && currentFloor === 1 && playerLevel === 1){
        playerHP=playerMaxHP; playerMP=playerMaxMP;
    }
    updateUI();
    showMessage(currentFloor+"F 冒険開始！ ⚔️");
}

// sessionStorageにデータがあれば自動スタート（階移動・ロード時）
if(sessionStorage.getItem(SESSION_KEY + "_from_transfer")){
    sessionStorage.removeItem(SESSION_KEY + "_from_transfer");
    startGame();
} else if(currentFloor > 1 || playerLevel > 1 || playerGold !== 50){
    // 引き継ぎデータで始まっている場合は自動スタート
    startGame();
}

// 回復ボタン
document.getElementById("hpPotBtn").addEventListener("click",()=>{
    if(!gameStarted||gameOver||hpPotCount<=0) return;
    if(playerHP>=playerMaxHP){ showMessage("HPは満タンです！"); return; }
    hpPotCount--;
    playerHP=playerMaxHP;
    updateUI();
    showMessage("💊 HP全回復！ (残り"+hpPotCount+"個)");
});
document.getElementById("mpPotBtn").addEventListener("click",()=>{
    if(!gameStarted||gameOver||mpPotCount<=0) return;
    if(playerMP>=playerMaxMP){ showMessage("MPは満タンです！"); return; }
    mpPotCount--;
    playerMP=playerMaxMP;
    updateUI();
    showMessage("💧 MP全回復！ (残り"+mpPotCount+"個)");
});

//////////////////////////////////////////////////////
// ステータス割り振りUI
//////////////////////////////////////////////////////
function openStatusUI(){
    if(document.getElementById("statusUI")) return;
    const overlay = document.createElement("div");
    overlay.id = "statusUI";
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:75;display:flex;align-items:center;
        justify-content:center;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);`;

    function render(){
        overlay.innerHTML = "";
        const box = document.createElement("div");
        box.style.cssText = `
            background:linear-gradient(160deg,#1e1a2e,#0f0d1a);
            border:1px solid rgba(168,85,247,0.4);border-radius:16px;
            padding:24px 28px;width:min(90vw,340px);
            box-shadow:0 0 40px rgba(124,58,237,0.3);`;

        const ptColor = statPoints>0 ? "#fbbf24" : "#9ca3af";
        box.innerHTML = `
            <div style="font-family:'Cinzel',serif;font-size:18px;color:#e9d5ff;
                text-align:center;letter-spacing:3px;margin-bottom:4px;">📊 ステータス</div>
            <div style="text-align:center;font-size:13px;color:${ptColor};margin-bottom:16px;">
                Lv.${playerLevel} &nbsp;|&nbsp; 未割り振りPT：<b style="font-size:16px;">${statPoints}</b>
            </div>`;

        const stats = [
            { key:"vit", label:"体力",   icon:"❤️",  desc:"HP +10",        val:statVit  },
            { key:"atk", label:"攻撃力", icon:"⚔️",  desc:"ATK +1",        val:statAtk  },
            { key:"def", label:"防御力", icon:"🛡️",  desc:"DEF +1",        val:statDef  },
            { key:"int", label:"知力",   icon:"🔮",  desc:"MP+10 / 魔法+5",val:statInt  },
            { key:"agi", label:"素早さ", icon:"💨",  desc:"攻撃間隔 -1F",  val:statAgi  },
        ];

        stats.forEach(s=>{
            const row = document.createElement("div");
            row.style.cssText = `display:flex;align-items:center;gap:8px;
                margin-bottom:10px;background:rgba(255,255,255,0.04);
                border-radius:10px;padding:10px 12px;`;
            const canUp = statPoints > 0;
            row.innerHTML = `
                <span style="font-size:18px;">${s.icon}</span>
                <div style="flex:1;">
                    <div style="font-size:13px;font-weight:700;color:#f3f4f6;">${s.label}</div>
                    <div style="font-size:10px;color:#9ca3af;">${s.desc}</div>
                </div>
                <span style="font-size:16px;font-weight:700;color:#e9d5ff;
                    width:28px;text-align:center;">${s.val}</span>
                <button data-key="${s.key}" style="
                    width:32px;height:32px;border-radius:8px;border:none;
                    background:${canUp?"linear-gradient(135deg,#7c3aed,#5b21b6)":"rgba(255,255,255,0.08)"};
                    color:${canUp?"#fff":"#6b7280"};font-size:18px;
                    cursor:${canUp?"pointer":"not-allowed"};line-height:1;">＋</button>`;
            row.querySelector("button").onclick = ()=>{
                if(statPoints<=0) return;
                statPoints--;
                if(s.key==="vit") statVit++;
                else if(s.key==="atk") statAtk++;
                else if(s.key==="def") statDef++;
                else if(s.key==="int") statInt++;
                else if(s.key==="agi") statAgi++;
                recalcStats();
                updateUI();
                render();
            };
            box.appendChild(row);
        });

        // 実値サマリー
        const summary = document.createElement("div");
        summary.style.cssText = `margin-top:12px;padding-top:12px;
            border-top:1px solid rgba(255,255,255,0.08);
            font-size:11px;color:#9ca3af;line-height:2;letter-spacing:1px;`;
        summary.innerHTML =
            "HP："+playerMaxHP+" &nbsp; MP："+playerMaxMP+"<br>"+
            "ATK："+getATK()+" &nbsp; DEF："+getDEF()+" &nbsp; 攻撃間隔："+getAGIFrames()+"F";
        box.appendChild(summary);

        const closeBtn = document.createElement("button");
        closeBtn.textContent = statPoints>0 ? "閉じる（残PT："+statPoints+"）" : "閉じる";
        closeBtn.style.cssText = `width:100%;margin-top:14px;padding:12px;
            background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
            border-radius:10px;color:#d1d5db;font-size:14px;font-weight:700;cursor:pointer;`;
        closeBtn.onclick = ()=>{ overlay.remove(); };
        box.appendChild(closeBtn);
        overlay.appendChild(box);
    }

    render();
    document.body.appendChild(overlay);
}

document.getElementById("statusBtn").addEventListener("click", openStatusUI);

//////////////////////////////////////////////////////
// メインループ
//////////////////////////////////////////////////////
function animate(){
    requestAnimationFrame(animate);
    if(!gameStarted||gameOver||gameCleared){ renderer.render(scene,camera); return; }
    updatePlayer();
    updateEnemies();
    updateFireballs();
    updateParticles();
    updateMPRegen();
    updateCamera();
    drawMinimap();
    renderer.render(scene,camera);
}
animate();

window.addEventListener("resize",()=>{
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth,window.innerHeight);
});
