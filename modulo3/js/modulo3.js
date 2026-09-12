/* =========================
   MENÚ DE MÓDULOS
   ========================= */
function toggleModuleMenu(event){
  event.stopPropagation();
  document.getElementById('moduleMenu').classList.toggle('show');
}

document.addEventListener('click',function(event){
  const menu=document.getElementById('moduleMenu');
  const wrap=document.querySelector('.module-menu-wrap');

  if(menu && wrap && !wrap.contains(event.target)){
    menu.classList.remove('show');
  }
});


/* =========================================================
   CLIENTES BBVA · SUPABASE · MÓDULO 3
   ========================================================= */

const SUPABASE_URL = 'https://tqknpjnjcbpopbvemtqd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_R4q9W_75TYNKbfPbJH-h5w_9mucjpSj';
const BUCKET = 'bbva-fotos';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let registros = [];
let fotos = {
  qr:null,
  antes:null,
  despues:null
};

let currentUser = null;
let currentProfile = null;
let perfiles = {};
let guardando = false;


/* =========================
   CORRELATIVO
   ========================= */

function pad(n){
  return String(n).padStart(4,'0');
}


/* =========================
   ESCAPAR HTML
   ========================= */

function esc(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}


/* =========================
   FECHA Y HORA
   ========================= */

function actualizarFecha(){

  const d = new Date();

  const f = d.toLocaleDateString('es-PE',{
    day:'2-digit',
    month:'2-digit',
    year:'numeric'
  });

  const h = d.toLocaleTimeString('es-PE',{
    hour:'2-digit',
    minute:'2-digit'
  });

  const elemento = document.getElementById('fechaHora');

  if(elemento){
    elemento.textContent = f+' · '+h;
  }
}

actualizarFecha();

setInterval(actualizarFecha,30000);


/* =========================
   LOGIN
   ========================= */

function mostrarLoading(show){

  const elemento =
    document.getElementById('loadingScreen');

  if(elemento){
    elemento.style.display =
      show ? 'flex' : 'none';
  }
}


function mostrarLogin(){

  document.body.classList.add('locked');

  const authBg =
    document.getElementById('authBg');

  const userBar =
    document.getElementById('userBar');

  if(authBg){
    authBg.style.display='flex';
  }

  if(userBar){
    userBar.style.display='none';
  }
}


function ocultarLogin(){

  document.body.classList.remove('locked');

  const authBg =
    document.getElementById('authBg');

  const userBar =
    document.getElementById('userBar');

  if(authBg){
    authBg.style.display='none';
  }

  if(userBar){
    userBar.style.display='flex';
  }
}


function mostrarErrorLogin(texto){

  const box =
    document.getElementById('authError');

  if(!box) return;

  box.textContent=texto;
  box.style.display='block';
}


async function iniciarSesion(){

  const email =
    document.getElementById('loginEmail')
      .value.trim();

  const password =
    document.getElementById('loginPassword')
      .value;

  if(!email || !password){

    mostrarErrorLogin(
      'Escribe tu correo y contraseña.'
    );

    return;
  }

  const btn =
    document.getElementById('loginBtn');

  btn.disabled=true;

  document.getElementById(
    'authError'
  ).style.display='none';


  const {data,error} =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });


  btn.disabled=false;


  if(error){

    mostrarErrorLogin(
      'No se pudo iniciar sesión. Revisa el correo y la contraseña.'
    );

    return;
  }


  await cargarSesion(data.user);
}


async function cerrarSesion(){

  await supabaseClient.auth.signOut();

  currentUser=null;
  currentProfile=null;
  registros=[];
  perfiles={};

  renderLista();

  const password =
    document.getElementById('loginPassword');

  if(password){
    password.value='';
  }

  mostrarLogin();
}


const loginPassword =
  document.getElementById('loginPassword');

if(loginPassword){

  loginPassword.addEventListener(
    'keydown',
    e=>{
      if(e.key==='Enter'){
        iniciarSesion();
      }
    }
  );

}


/* =========================
   SESIÓN / PERFIL
   ========================= */

async function cargarSesion(user){

  currentUser=user;


  const {data:profile,error} =
    await supabaseClient
      .from('profiles')
      .select('id,nombre,role')
      .eq('id',user.id)
      .maybeSingle();


  if(error || !profile){

    alert(
      'La cuenta existe, pero todavía no tiene un perfil en el Módulo 3.'
    );

    await supabaseClient.auth.signOut();

    mostrarLogin();

    return;
  }


  currentProfile=profile;


  const userName =
    document.getElementById('userName');

  if(userName){

    userName.textContent =
      profile.nombre +
      (
        profile.role==='admin'
          ? ' · ADMIN'
          : ''
      );
  }


  ocultarLogin();

  await cargarRegistros();
}


supabaseClient.auth.onAuthStateChange(
  async (event,session)=>{

    if(event==='SIGNED_OUT'){
      mostrarLogin();
    }

  }
);


/* =========================
   INICIALIZAR
   ========================= */

async function inicializar(){

  mostrarLoading(true);

  const TIMEOUT = 7000;

  const timeout = ms =>
    new Promise((_, reject)=>
      setTimeout(
        ()=>reject(new Error('TIMEOUT')),
        ms
      )
    );


  try{

    const resultado =
      await Promise.race([

        supabaseClient.auth.getSession(),

        timeout(TIMEOUT)

      ]);


    const session =
      resultado?.data?.session || null;


    mostrarLoading(false);


    if(session){

      try{

        await Promise.race([

          cargarSesion(session.user),

          timeout(TIMEOUT)

        ]);

      }catch(error){

        console.error(
          'No se pudo cargar la sesión/perfil:',
          error
        );

        await supabaseClient.auth
          .signOut()
          .catch(()=>{});

        currentUser=null;
        currentProfile=null;

        mostrarLogin();

        mostrarErrorLogin(
          'La conexión con Supabase está tardando. Vuelve a intentar iniciar sesión.'
        );

      }

    }else{

      mostrarLogin();

    }

  }catch(error){

    console.error(
      'Error al iniciar:',
      error
    );

    mostrarLoading(false);

    mostrarLogin();

    mostrarErrorLogin(
      'No se pudo conectar con el sistema. Recarga la página e inténtalo nuevamente.'
    );
  }
}


/* =========================
   CARGAR PERFILES
   ========================= */

async function cargarPerfiles(){

  perfiles={};


  if(
    !currentProfile ||
    currentProfile.role!=='admin'
  ){

    perfiles[currentUser.id] =
      currentProfile?.nombre || '';

    return;
  }


  const {data,error} =
    await supabaseClient
      .from('profiles')
      .select('id,nombre,role');


  if(error){

    console.error(error);

    return;
  }


  (data||[]).forEach(
    p=>{
      perfiles[p.id]=p.nombre;
    }
  );
}


/* =========================
   CARGAR REGISTROS ONLINE
   ========================= */

async function cargarRegistros(){

  const {data,error} =
    await supabaseClient
      .from('bbva_registros')
      .select('*')
      .eq('sino','Módulo 3')
      .order('correlativo',{
        ascending:true
      });


  if(error){

    alert(
      'No se pudieron cargar los registros: '+
      error.message
    );

    return;
  }


  const todos=data||[];


  registros =
    todos.filter(
      r=>r.eliminado!==true
    );


  papeleraRegistros =
    todos.filter(
      r=>r.eliminado===true
    );


  await cargarPerfiles();

  await prepararUrlsFotos();

  await prepararUrlsPapelera();

  siguienteCorrelativo();

  renderLista();

  renderPapelera();
}


/* =========================
   PREPARAR FOTOS
   ========================= */

async function prepararUrlsFotos(){

  const paths=[];


  registros.forEach(r=>{

    if(r.qr_path)
      paths.push(r.qr_path);

    if(r.antes_path)
      paths.push(r.antes_path);

    if(r.despues_path)
      paths.push(r.despues_path);

  });


  const unique=[
    ...new Set(paths)
  ];


  if(!unique.length) return;


  const {data,error} =
    await supabaseClient
      .storage
      .from(BUCKET)
      .createSignedUrls(
        unique,
        3600
      );


  if(error){

    console.error(
      'Error creando URLs firmadas:',
      error
    );

    return;
  }


  const urlMap={};


  (data||[]).forEach(item=>{

    if(item.path && item.signedUrl){

      urlMap[item.path] =
        item.signedUrl;

    }

  });


  registros.forEach(r=>{

    r.qr_url =
      urlMap[r.qr_path] || '';

    r.antes_url =
      urlMap[r.antes_path] || '';

    r.despues_url =
      urlMap[r.despues_path] || '';

  });
}


/* =========================
   CORRELATIVO
   ========================= */

function siguienteCorrelativo(){

  const siguiente =
    registros.length + 1;

  const elemento =
    document.getElementById(
      'correlativo'
    );

  if(elemento){

    elemento.textContent =
      pad(siguiente);

  }
}


/* =========================================================
   BUSQUEDA DNI + NOMBRE AUTOMÁTICO
   SUPABASE EDGE FUNCTION + APISPERU
   ========================================================= */

const dniInput =
  document.getElementById('dni');

const clienteInput =
  document.getElementById('cliente');

let dniTimer = null;


/* =========================
   CONSULTAR DNI
   ========================= */

async function consultarDNI(dni){

  const msg =
    document.getElementById('dniMsg');


  if(!msg || !clienteInput){
    return;
  }


  if(!/^\d{8}$/.test(dni)){

    msg.innerHTML =
      '<div class="hint">' +
      'El DNI debe tener exactamente 8 dígitos.' +
      '</div>';

    return;
  }


  msg.innerHTML =
    '<div class="hint">' +
    'Consultando DNI...' +
    '</div>';


  try{

    /*
      IMPORTANTE:

      Ya NO usamos el token de APISPERU aquí.

      La consulta se hace mediante:

      Supabase
          ↓
      Edge Function consultar-dni
          ↓
      APISPERU
    */

    const {data,error} =
      await supabaseClient.functions.invoke(
        'consultar-dni',
        {
          body:{
            dni:dni
          }
        }
      );


    console.log(
      'Respuesta DNI:',
      data
    );


    if(error){

      console.error(
        'Error de Supabase:',
        error
      );

      throw new Error(
        error.message ||
        'No se pudo conectar con la consulta DNI.'
      );
    }


    if(!data){

      throw new Error(
        'La consulta no devolvió información.'
      );
    }


    if(data.success === false){

      throw new Error(
        data.message ||
        'No se pudo consultar el DNI.'
      );
    }


    /*
      La Edge Function devuelve:

      nombre:
      LISMAN ERCILIO LOPEZ QUEZADA

      También devuelve:
      nombres
      apellido_paterno
      apellido_materno
    */


    const nombre =
      String(
        data.nombre ||
        data.nombre_completo ||
        data.nombreCompleto ||
        [
          data.nombres,
          data.apellido_paterno,
          data.apellido_materno
        ]
        .filter(Boolean)
        .join(' ')
      )
      .trim();


    if(!nombre){

      throw new Error(
        'La API no devolvió el nombre para este DNI.'
      );
    }


    /*
      COLOCAR NOMBRE AUTOMÁTICAMENTE
    */

    clienteInput.value =
      nombre.toUpperCase();


    msg.innerHTML =
      '<div class="ok">' +
      '✓ Cliente encontrado: ' +
      esc(nombre) +
      '</div>';


  }catch(error){

    console.error(
      'Error consultando DNI:',
      error
    );


    msg.innerHTML =
      '<div class="hint">' +
      'No se pudo consultar el DNI: ' +
      esc(
        error.message ||
        'Error de consulta'
      ) +
      '. Puedes escribir el nombre manualmente.' +
      '</div>';

  }
}


/* =========================
   DETECTAR DNI
   ========================= */

if(dniInput){

  dniInput.addEventListener(
    'input',
    function(){

      let v =
        this.value
          .replace(/\D/g,'')
          .slice(0,8);


      this.value=v;


      const msg =
        document.getElementById(
          'dniMsg'
        );


      if(msg){
        msg.innerHTML='';
      }


      clearTimeout(dniTimer);


      /*
        Si borra completamente el DNI,
        también borramos el cliente.
      */

      if(v.length===0){

        if(clienteInput){
          clienteInput.value='';
        }

        return;
      }


      /*
        Mostrar dígitos faltantes.
      */

      if(v.length<8){

        if(msg){

          msg.innerHTML =
            '<div class="hint">' +
            'Faltan ' +
            (8-v.length) +
            ' dígitos.' +
            '</div>';

        }

        return;
      }


      /*
        Al completar los 8 dígitos,
        esperamos 250 ms y consultamos.
      */

      dniTimer =
        setTimeout(
          ()=>{
            consultarDNI(v);
          },
          250
        );

    }
  );

}


/* =========================
   NUMERO DUPLICADO
   ========================= */

const numeroInput =
  document.getElementById('numero');


if(numeroInput){

  numeroInput.addEventListener(
    'input',
    e=>{

      const v =
        e.target.value
          .replace(/\D/g,'');


      e.target.value=v;


      const msg =
        document.getElementById(
          'numeroMsg'
        );


      const dup =
        registros.some(
          r=>String(r.numero)===v
        );


      if(v.length>=1 && dup){

        msg.innerHTML =
          '<div class="warn">' +
          '⚠️ Este número ya aparece en los registros cargados.' +
          '</div>';

      }else{

        msg.innerHTML='';

      }

    }
  );

}


/* =========================
   FOTOS
   ========================= */

function resizeImage(file){

  return new Promise(
    (resolve,reject)=>{

      const reader =
        new FileReader();


      reader.onload=e=>{

        const img =
          new Image();


        img.onload=()=>{

          const maxW=1200;

          const scale =
            Math.min(
              1,
              maxW/img.width
            );


          const canvas =
            document.createElement(
              'canvas'
            );


          canvas.width =
            Math.max(
              1,
              Math.round(
                img.width*scale
              )
            );


          canvas.height =
            Math.max(
              1,
              Math.round(
                img.height*scale
              )
            );


          const ctx =
            canvas.getContext('2d');


          ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
          );


          canvas.toBlob(
            blob=>{

              if(!blob){

                reject(
                  new Error(
                    'No se pudo procesar la imagen.'
                  )
                );

                return;
              }


              const dataUrl =
                canvas.toDataURL(
                  'image/jpeg',
                  0.75
                );


              resolve({
                blob,
                dataUrl
              });

            },
            'image/jpeg',
            0.75
          );

        };


        img.onerror=()=>{

          reject(
            new Error(
              'Imagen no válida.'
            )
          );

        };


        img.src=e.target.result;

      };


      reader.onerror=()=>{

        reject(
          new Error(
            'No se pudo leer la imagen.'
          )
        );

      };


      reader.readAsDataURL(file);

    }
  );
}


function setupPhotoBox(
  key,
  boxId,
  inputId
){

  const box =
    document.getElementById(boxId);

  const input =
    document.getElementById(inputId);


  if(!box || !input){
    return;
  }


  input.addEventListener(
    'change',
    async()=>{

      if(
        !input.files ||
        !input.files[0]
      ){
        return;
      }


      try{

        fotos[key] =
          await resizeImage(
            input.files[0]
          );


        renderPhotoBox(
          key,
          boxId
        );


      }catch(error){

        console.error(error);

        alert(
          'No se pudo cargar la imagen. Verifica que sea una foto válida.'
        );

      }

    }
  );
}


function renderPhotoBox(
  key,
  boxId
){

  const box =
    document.getElementById(boxId);


  if(!box) return;


  if(fotos[key]){

    box.classList.add('filled');


    box.innerHTML=`

      <img
        src="${fotos[key].dataUrl}"
        alt=""
      >

      <button
        class="remove"
        onclick="quitarFoto('${key}','${boxId}')">

        ✕

      </button>

    `;

  }
}


function quitarFoto(
  key,
  boxId
){

  fotos[key]=null;

  rebuildPhotoBox(
    key,
    boxId
  );
}


function rebuildPhotoBox(
  key,
  boxId
){

  const labels={

    qr:[
      'FOTO QR<br>BBVA',
      'Obligatoria'
    ],

    antes:[
      'FOTO<br>ANTES',
      'Opcional'
    ],

    despues:[
      'FOTO<br>DESPUÉS',
      'Opcional'
    ]

  };


  const [lbl,tag]=
    labels[key];


  const box =
    document.getElementById(boxId);


  if(!box) return;


  box.classList.remove(
    'filled'
  );


  const reqClass =
    tag==='Obligatoria'
      ? 'req'
      : 'hint';


  box.innerHTML=`

    <div class="cam">
      📷
    </div>

    <div class="lbl">
      ${lbl}
    </div>

    <div
      class="${reqClass}"
      style="${
        tag!=='Obligatoria'
          ? 'margin:0;font-size:10px;'
          : ''
      }">

      ${tag}

    </div>

    <input
      type="file"
      accept="image/*"
      id="file-${key}"
    >

  `;


  setupPhotoBox(
    key,
    boxId,
    'file-'+key
  );
}


setupPhotoBox(
  'qr',
  'box-qr',
  'file-qr'
);

setupPhotoBox(
  'antes',
  'box-antes',
  'file-antes'
);

setupPhotoBox(
  'despues',
  'box-despues',
  'file-despues'
);


/* =========================
   LIMPIAR
   ========================= */

function limpiarCampos(){

  const dni =
    document.getElementById('dni');

  const cliente =
    document.getElementById('cliente');

  const numero =
    document.getElementById('numero');

  const sino =
    document.getElementById('sino');

  if(dni) dni.value='';

  if(cliente) cliente.value='';

  if(numero) numero.value='';

  if(sino) sino.value='';


  const dniMsg =
    document.getElementById('dniMsg');

  const numeroMsg =
    document.getElementById('numeroMsg');


  if(dniMsg){
    dniMsg.innerHTML='';
  }

  if(numeroMsg){
    numeroMsg.innerHTML='';
  }


  fotos={
    qr:null,
    antes:null,
    despues:null
  };


  rebuildPhotoBox(
    'qr',
    'box-qr'
  );

  rebuildPhotoBox(
    'antes',
    'box-antes'
  );

  rebuildPhotoBox(
    'despues',
    'box-despues'
  );
}


/* =========================
   AGREGAR NUEVO
   ========================= */

async function agregarNuevo(){

  const dni =
    document.getElementById('dni')
      .value.trim();

  const cliente =
    document.getElementById('cliente')
      .value.trim();

  const numero =
    document.getElementById('numero')
      .value.trim();


  if(
    dni ||
    cliente ||
    numero ||
    fotos.qr ||
    fotos.antes ||
    fotos.despues
  ){

    const ok =
      await guardarRegistro();


    if(!ok) return;

  }


  limpiarCampos();


  const dniElement =
    document.getElementById('dni');


  if(dniElement){
    dniElement.focus();
  }
}


/* =========================
   HASH FOTO
   ========================= */

async function hashBlob(blob){

  const buffer =
    await blob.arrayBuffer();


  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      buffer
    );


  return Array
    .from(
      new Uint8Array(digest)
    )
    .map(
      b=>b.toString(16)
        .padStart(2,'0')
    )
    .join('');
}


/* =========================
   SUBIR FOTO
   ========================= */

async function subirFoto(
  blob,
  key
){

  const hash =
    await hashBlob(blob);


  const path =
    'modulo3/'+hash+'.jpg';


  const {error} =
    await supabaseClient
      .storage
      .from(BUCKET)
      .upload(
        path,
        blob,
        {
          contentType:'image/jpeg',
          cacheControl:'3600',
          upsert:false
        }
      );


  if(error){

    throw new Error(
      'No se pudo subir la foto a Supabase.\n\n' +
      'Detalle: '+error.message+
      '\nCódigo: '+
      (
        error.statusCode ||
        error.status ||
        'sin código'
      )
    );

  }


  return path;
}


/* =========================
   GUARDAR REGISTRO
   ========================= */

async function guardarRegistro(){

  if(guardando){
    return false;
  }


  const dni =
    document.getElementById('dni')
      .value.trim();

  const cliente =
    document.getElementById('cliente')
      .value.trim();

  const numero =
    document.getElementById('numero')
      .value.trim();

  const sino='Módulo 3';


  if(!currentUser){

    alert(
      'Debes iniciar sesión.'
    );

    return false;
  }


  if(dni.length!==8){

    alert(
      'El DNI debe tener 8 dígitos.'
    );

    return false;
  }


  if(!cliente){

    alert(
      'Ingresa el nombre del cliente.'
    );

    return false;
  }


  if(!numero){

    alert(
      'Ingresa el número BBVA.'
    );

    return false;
  }


  if(!fotos.qr){

    alert(
      'La foto del QR BBVA es obligatoria.'
    );

    return false;
  }


  if(
    dni &&
    registros.some(
      r=>String(r.dni||'').trim()===dni
    )
  ){

    alert(
      'Este DNI ya aparece en los registros cargados.'
    );

    return false;
  }


  if(
    registros.some(
      r=>String(r.numero)===numero
    )
  ){

    alert(
      'Este número BBVA ya aparece en los registros cargados.'
    );

    return false;
  }


  guardando=true;

  let uploaded=[];


  try{

    const qr_path =
      await subirFoto(
        fotos.qr.blob,
        'qr'
      );


    uploaded.push(qr_path);


    let antes_path=null;
    let despues_path=null;


    if(fotos.antes){

      antes_path =
        await subirFoto(
          fotos.antes.blob,
          'antes'
        );

      uploaded.push(
        antes_path
      );

    }


    if(fotos.despues){

      despues_path =
        await subirFoto(
          fotos.despues.blob,
          'despues'
        );

      uploaded.push(
        despues_path
      );

    }


    const {data,error} =
      await supabaseClient
        .from('bbva_registros')
        .insert({

          user_id:
            currentUser.id,

          correlativo:
            registros.length + 1,

          dni,

          cliente:
            cliente || null,

          numero,

          qr_path,

          antes_path,

          despues_path,

          sino:
            sino || null,

          eliminado:false

        })
        .select()
        .single();


    if(error){

      await supabaseClient
        .storage
        .from(BUCKET)
        .remove(uploaded);


      if(error.code==='23505'){

        alert(
          '❌ Ese número BBVA ya está registrado por otro usuario.'
        );

      }else{

        alert(
          '❌ No se pudo guardar: '+
          error.message
        );

      }


      return false;
    }


    registros.push(data);


    const {data:profile} =
      await supabaseClient
        .from('profiles')
        .select('id,nombre,role')
        .eq(
          'id',
          data.user_id
        )
        .maybeSingle();


    if(profile){

      perfiles[profile.id] =
        profile.nombre;

    }


    await prepararUrlsFotos();

    renderLista();

    siguienteCorrelativo();

    limpiarCampos();


    alert(
      '✅ Registro guardado correctamente.\n\n' +
      'Correlativo: '+
      pad(data.correlativo)
    );


    return true;


  }catch(error){

    if(uploaded.length){

      await supabaseClient
        .storage
        .from(BUCKET)
        .remove(uploaded);

    }


    alert(
      '❌ No se pudo guardar el registro.\n\n'+
      error.message
    );


    return false;


  }finally{

    guardando=false;

  }
}


/* =========================
   ELIMINAR
   ========================= */

async function eliminarRegistro(id){

  const r =
    registros.find(
      x=>String(x.id)===String(id)
    );


  if(!r) return;


  if(
    !confirm(
      '¿Enviar este registro a la papelera?'
    )
  ){
    return;
  }


  const {error} =
    await supabaseClient
      .from('bbva_registros')
      .update({
        eliminado:true
      })
      .eq(
        'id',
        r.id
      );


  if(error){

    alert(
      '❌ No se pudo enviar a la papelera: '+
      error.message
    );

    return;
  }


  await cargarRegistros();
}


/* =========================
   RESTAURAR
   ========================= */

async function restaurarRegistro(id){

  const r =
    papeleraRegistros.find(
      x=>String(x.id)===String(id)
    );


  if(!r) return;


  if(
    !confirm(
      '¿Restaurar este registro?'
    )
  ){
    return;
  }


  const {error} =
    await supabaseClient
      .from('bbva_registros')
      .update({
        eliminado:false
      })
      .eq(
        'id',
        r.id
      );


  if(error){

    alert(
      '❌ No se pudo restaurar: '+
      error.message
    );

    return;
  }


  alert(
    '✅ Registro restaurado correctamente.'
  );


  await cargarRegistros();
}


/* =========================
   PAPELERA
   ========================= */

function renderPapelera(){

  const titulo =
    document.getElementById(
      'papeleraTitulo'
    );

  const wrap =
    document.getElementById(
      'papelera'
    );

  const count =
    document.getElementById(
      'papeleraCount'
    );


  if(!titulo || !wrap) return;


  if(count){
    count.textContent =
      papeleraRegistros.length;
  }


  if(
    papeleraRegistros.length===0
  ){

    titulo.style.display='none';

    wrap.style.display='none';

    wrap.innerHTML='';

    return;
  }


  titulo.style.display='block';

  wrap.style.display='block';


  wrap.innerHTML =
    papeleraRegistros
      .slice()
      .reverse()
      .map(r=>`

        <div
          class="reg"
          style="opacity:.92;">

          <div class="head">

            <div>

              <div class="corr">
                #${pad(r.correlativo)} —
                ${esc(r.cliente||'Sin nombre')}
              </div>

              <div class="meta">
                DNI ${esc(r.dni||'—')}
                · Número ${esc(r.numero||'—')}
              </div>

            </div>

            <span class="badge">
              ELIMINADO
            </span>

          </div>

          <button
            class="btn btn-outline"
            style="width:100%;margin-top:8px;"
            onclick="restaurarRegistro('${r.id}')">

            ♻️ Restaurar registro

          </button>

        </div>

      `)
      .join('');
}


/* =========================
   VER REGISTRO
   ========================= */

function verRegistro(id){

  const r =
    registros.find(
      x=>String(x.id)===String(id)
    );


  if(!r) return;


  const nombre =
    perfiles[r.user_id] || '—';


  document.getElementById(
    'modalTitle'
  ).textContent =
    `#${pad(r.correlativo)} · ${
      r.cliente || 'Sin nombre'
    }`;


  let html=`

    <div class="hint">

      Trabajador:
      ${esc(nombre)}

      <br>

      DNI:
      ${esc(r.dni)}

      · Número:
      ${esc(r.numero)}

      ·
      ${esc(r.sino||'—')}

    </div>

  `;


  if(r.qr_url){

    html+=`

      <div
        style="
          margin-top:10px;
          font-weight:700;
          font-size:12.5px;
        ">

        QR BBVA

      </div>

      <img
        src="${r.qr_url}"
        alt="QR BBVA">

    `;

  }


  if(r.antes_url){

    html+=`

      <div
        style="
          margin-top:10px;
          font-weight:700;
          font-size:12.5px;
        ">

        Antes

      </div>

      <img
        src="${r.antes_url}"
        alt="Antes">

    `;

  }


  if(r.despues_url){

    html+=`

      <div
        style="
          margin-top:10px;
          font-weight:700;
          font-size:12.5px;
        ">

        Después

      </div>

      <img
        src="${r.despues_url}"
        alt="Después">

    `;

  }


  document.getElementById(
    'modalBody'
  ).innerHTML=html;


  document.getElementById(
    'modalBg'
  ).classList.add('show');
}


function cerrarModal(){

  document.getElementById(
    'modalBg'
  ).classList.remove('show');

}


/* =========================
   LISTA
   ========================= */

function renderLista(){

  const wrap =
    document.getElementById(
      'lista'
    );


  document.getElementById(
    'regCount'
  ).textContent =
    registros.length;


  if(registros.length===0){

    wrap.innerHTML =
      '<div class="empty">Aún no hay registros guardados.</div>';

    return;
  }


  wrap.innerHTML =
    registros
      .slice()
      .reverse()
      .map(r=>{

        const nombre =
          currentProfile?.role==='admin'
            ? (
                perfiles[r.user_id] ||
                '—'
              )
            : '';


        return `

          <div class="reg">

            <div class="head">

              <div>

                <div class="corr">

                  #${pad(r.correlativo)} —

                  ${esc(
                    r.cliente ||
                    'Sin nombre'
                  )}

                </div>


                <div class="meta">

                  ${
                    nombre
                      ? '👤 '+
                        esc(nombre)+
                        ' · '
                      : ''
                  }

                  DNI
                  ${esc(r.dni)}

                  · Número
                  ${esc(r.numero)}

                </div>

              </div>


              ${
                r.sino

                  ? `
                    <span
                      class="badge ${
                        String(r.sino)
                          .toLowerCase()
                      }">

                      ${esc(r.sino)}

                    </span>
                  `

                  : ''
              }

            </div>


            <div
              class="thumbs"
              onclick="verRegistro('${r.id}')">

              ${
                r.qr_url

                  ? `
                    <img
                      src="${r.qr_url}"
                      alt="QR">
                  `

                  : `
                    <div class="ph">
                      QR
                    </div>
                  `
              }


              ${
                r.antes_url

                  ? `
                    <img
                      src="${r.antes_url}"
                      alt="Antes">
                  `

                  : `
                    <div class="ph">
                      ANTES
                    </div>
                  `
              }


              ${
                r.despues_url

                  ? `
                    <img
                      src="${r.despues_url}"
                      alt="Después">
                  `

                  : `
                    <div class="ph">
                      DESP.
                    </div>
                  `
              }

            </div>


            <button
              class="del"
              onclick="eliminarRegistro('${r.id}')">

              Eliminar

            </button>

          </div>

        `;

      })
      .join('');
}


/* =========================
   EXPORTAR EXCEL
   ========================= */

function blobToDataUrl(blob){

  return new Promise(
    (resolve,reject)=>{

      const reader =
        new FileReader();


      reader.onload=()=>
        resolve(
          reader.result
        );


      reader.onerror=reject;


      reader.readAsDataURL(blob);

    }
  );
}


async function exportarExcel(){

  if(registros.length===0){

    alert(
      'No hay registros para exportar.'
    );

    return;
  }


  if(typeof ExcelJS==='undefined'){

    alert(
      'No se pudo cargar el módulo de Excel. Recarga la página e inténtalo nuevamente.'
    );

    return;
  }


  try{

    mostrarLoading(true);


    const workbook =
      new ExcelJS.Workbook();


    workbook.creator =
      'Módulo 3 BBVA';


    workbook.created =
      new Date();


    const ws =
      workbook.addWorksheet(
        'MODULO 3'
      );


    ws.columns=[

      {
        header:'CORRELATIVO',
        key:'correlativo',
        width:13
      },

      {
        header:'TRABAJADOR',
        key:'trabajador',
        width:24
      },

      {
        header:'CLIENTE',
        key:'cliente',
        width:32
      },

      {
        header:'DNI',
        key:'dni',
        width:12
      },

      {
        header:'NÚMERO BBVA',
        key:'numero',
        width:17
      },

      {
        header:'MÓDULO',
        key:'sino',
        width:10
      },

      {
        header:'FECHA',
        key:'fecha',
        width:20
      },

      {
        header:'FOTO QR BBVA',
        key:'qr',
        width:22
      }

    ];


    const headerRow =
      ws.getRow(1);


    headerRow.font={
      bold:true
    };


    headerRow.alignment={
      vertical:'middle',
      horizontal:'center'
    };


    headerRow.height=24;


    for(const r of registros){

      const row =
        ws.addRow({

          correlativo:
            pad(r.correlativo),

          trabajador:
            perfiles[r.user_id]||'',

          cliente:
            r.cliente||'',

          dni:
            r.dni||'',

          numero:
            r.numero||'',

          sino:
            r.sino||'',

          fecha:
            r.fecha
              ? new Date(
                  r.fecha
                ).toLocaleString(
                  'es-PE'
                )
              : '',

          qr:''

        });


      row.height=82;

      row.alignment={
        vertical:'middle'
      };


      if(r.qr_url){

        try{

          const response =
            await fetch(
              r.qr_url
            );


          if(response.ok){

            const blob =
              await response.blob();


            const dataUrl =
              await blobToDataUrl(
                blob
              );


            const imageId =
              workbook.addImage({

                base64:dataUrl,

                extension:'jpeg'

              });


            ws.addImage(
              imageId,
              `H${row.number}:H${row.number}`
            );

          }

        }catch(imgError){

          console.warn(
            'No se pudo insertar QR:',
            imgError
          );

        }

      }

    }


    const buffer =
      await workbook.xlsx
        .writeBuffer();


    const blob =
      new Blob(
        [buffer],
        {
          type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      );


    const url =
      URL.createObjectURL(blob);


    const a =
      document.createElement('a');


    a.href=url;

    a.download =
      'MODULO3_BBVA.xlsx';


    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);


  }catch(error){

    alert(
      '❌ No se pudo exportar a Excel.\n\n'+
      error.message
    );

  }finally{

    mostrarLoading(false);

  }
}


/* =========================
   COPIA DE SEGURIDAD
   ========================= */

function crearCopiaSeguridad(){

  if(registros.length===0){

    alert(
      'No hay registros para hacer una copia de seguridad.'
    );

    return;
  }


  const respaldo={

    version:2,

    aplicacion:
      'MODULO 3 BBVA',

    fechaBackup:
      new Date().toISOString(),

    registros:
      registros.map(
        r=>({

          id:r.id,

          user_id:
            r.user_id,

          correlativo:
            r.correlativo,

          dni:
            r.dni,

          cliente:
            r.cliente,

          numero:
            r.numero,

          qr_path:
            r.qr_path,

          antes_path:
            r.antes_path,

          despues_path:
            r.despues_path,

          sino:
            r.sino,

          fecha:
            r.fecha,

          created_at:
            r.created_at

        })
      )

  };


  try{

    const contenido =
      JSON.stringify(
        respaldo,
        null,
        2
      );


    const blob =
      new Blob(
        [contenido],
        {
          type:
            'application/json'
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const enlace =
      document.createElement(
        'a'
      );


    enlace.href=url;


    const fecha =
      new Date();


    const nombreFecha =
      fecha.getFullYear()+'-'+
      String(
        fecha.getMonth()+1
      ).padStart(2,'0')+'-'+
      String(
        fecha.getDate()
      ).padStart(2,'0')+'_ '+
      String(
        fecha.getHours()
      ).padStart(2,'0')+'-'+
      String(
        fecha.getMinutes()
      ).padStart(2,'0');


    enlace.download =
      `BACKUP_MODULO3_BBVA_${
        nombreFecha.replace(' ','')
      }.json`;


    document.body.appendChild(
      enlace
    );


    enlace.click();


    document.body.removeChild(
      enlace
    );


    URL.revokeObjectURL(
      url
    );


    alert(

      '✅ COPIA DE SEGURIDAD CREADA\n\n'+

      'Registros incluidos: '+
      registros.length+

      '\n\nLas fotos permanecen almacenadas en Supabase.'

    );


  }catch(error){

    alert(
      '❌ No se pudo crear la copia de seguridad.\n\n'+
      error.message
    );

  }
}


/* =========================
   RESTAURAR COPIA
   ========================= */

async function restaurarCopia(event){

  const file =
    event.target.files?.[0];


  event.target.value='';


  if(!file) return;


  alert(
    'La restauración desde JSON se mantiene como respaldo. Para recuperar registros eliminados, usa la Papelera y el botón "Restaurar registro".'
  );
}


/* =========================
   INICIO
   ========================= */

let papeleraRegistros = [];


async function prepararUrlsPapelera(){

  if(
    !papeleraRegistros ||
    papeleraRegistros.length===0
  ){
    return;
  }


  const paths=[];


  papeleraRegistros.forEach(r=>{

    if(r.qr_path)
      paths.push(r.qr_path);

    if(r.antes_path)
      paths.push(r.antes_path);

    if(r.despues_path)
      paths.push(r.despues_path);

  });


  const unique=[
    ...new Set(paths)
  ];


  if(!unique.length){
    return;
  }


  const {data,error} =
    await supabaseClient
      .storage
      .from(BUCKET)
      .createSignedUrls(
        unique,
        3600
      );


  if(error){

    console.error(
      'Error creando URLs de papelera:',
      error
    );

    return;
  }


  const urlMap={};


  (data||[]).forEach(item=>{

    if(item.path && item.signedUrl){

      urlMap[item.path]=
        item.signedUrl;

    }

  });


  papeleraRegistros.forEach(r=>{

    r.qr_url =
      urlMap[r.qr_path]||'';

    r.antes_url =
      urlMap[r.antes_path]||'';

    r.despues_url =
      urlMap[r.despues_path]||'';

  });
}


/* =========================
   INICIAR SISTEMA
   ========================= */

inicializar();