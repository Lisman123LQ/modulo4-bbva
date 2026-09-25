/* =========================
   SELECTOR DE MÓDULOS
   ========================= */

function cambiarModulo(modulo) {
  const rutas = {
    '1': '../modulo1/index.html',
    '2': '../modulo2/index.html',
    '3': '../modulo3/index.html',
    '4': '../modulo4/index.html'
  };

  if (rutas[modulo] && modulo !== '4') {
    window.location.href = rutas[modulo];
  }
}


/* =========================
   MENÚ DE MÓDULOS
   ========================= */

function toggleModuleMenu(event) {
  if (event) {
    event.stopPropagation();
  }

  const menu = document.getElementById('moduleMenu');

  if (menu) {
    menu.classList.toggle('show');
  }
}

document.addEventListener('click', function (event) {
  const menu = document.getElementById('moduleMenu');
  const wrap = document.querySelector('.module-menu-wrap');

  if (menu && wrap && !wrap.contains(event.target)) {
    menu.classList.remove('show');
  }
});


/* =========================================================
   CLIENTES BBVA · SUPABASE
   ========================================================= */

const SUPABASE_URL =
  'https://tqknpjnjcbpopbvemtqd.supabase.co';

const SUPABASE_KEY =
  'sb_publishable_R4q9W_75TYNKbfPbJH-h5w_9mucjpSj';

const BUCKET = 'bbva-fotos';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: 'bbva-sistema-auth'
    }
  }
);
/* SESION_COMPARTIDA_BBVA: la sesión de Supabase permanece al cambiar de módulo. */
(function(){
  try {
    window.addEventListener('storage', function(e){
      if(e.key === 'bbva_app_logout' && e.newValue){ location.reload(); }
    });
  } catch(e) {}
})();



/* =========================
   VARIABLES
   ========================= */

let registros = [];

let papeleraRegistros = [];

let fotos = {
  qr: null,
  antes: null,
  despues: null,
  pago: null
};

let currentUser = null;
let currentProfile = null;

let perfiles = {};

let guardando = false;
let editandoId = null;
let mapa = null;
let marcadorMapa = null;
let ubicacionTemporal = { lat: null, lng: null };

let dniTimer = null;


/* =========================
   UTILIDADES
   ========================= */

function pad(n) {
  return String(n).padStart(4, '0');
}


function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}


/* =========================
   FECHA Y HORA
   ========================= */

function actualizarFecha() {
  const fecha = document.getElementById('fechaHora');

  if (!fecha) {
    return;
  }

  const d = new Date();

  const f = d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const h = d.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  fecha.textContent = f + ' · ' + h;
}

actualizarFecha();

setInterval(actualizarFecha, 30000);


/* =========================
   LOGIN
   ========================= */

function mostrarLoading(show) {
  const loading = document.getElementById('loadingScreen');

  if (!loading) {
    return;
  }

  loading.style.display = show ? 'flex' : 'none';
}


function mostrarLogin() {
  document.body.classList.add('locked');

  const authBg = document.getElementById('authBg');
  const userBar = document.getElementById('userBar');

  if (authBg) {
    authBg.style.display = 'flex';
  }

  if (userBar) {
    userBar.style.display = 'none';
  }
}


function ocultarLogin() {
  document.body.classList.remove('locked');

  const authBg = document.getElementById('authBg');
  const userBar = document.getElementById('userBar');

  if (authBg) {
    authBg.style.display = 'none';
  }

  if (userBar) {
    userBar.style.display = 'flex';
  }
}


function mostrarErrorLogin(texto) {
  const box = document.getElementById('authError');

  if (!box) {
    return;
  }

  box.textContent = texto;
  box.style.display = 'block';
}


async function iniciarSesion() {
  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');

  if (!emailInput || !passwordInput) {
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    mostrarErrorLogin('Escribe tu correo y contraseña.');
    return;
  }

  const btn = document.getElementById('loginBtn');

  if (btn) {
    btn.disabled = true;
  }

  const errorBox = document.getElementById('authError');

  if (errorBox) {
    errorBox.style.display = 'none';
  }

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

    if (error) {
      mostrarErrorLogin(
        'No se pudo iniciar sesión. Revisa el correo y la contraseña.'
      );
      return;
    }

    if (!data || !data.user) {
      mostrarErrorLogin(
        'No se recibió la información de la cuenta.'
      );
      return;
    }

    await cargarSesion(data.user);

  } catch (error) {
    console.error('Error iniciando sesión:', error);

    mostrarErrorLogin(
      error.message ||
      'No se pudo iniciar sesión.'
    );

  } finally {
    if (btn) {
      btn.disabled = false;
    }
  }
}


async function cerrarSesion() {
  try {
    await supabaseClient.auth.signOut();
  } catch (error) {
    console.error('Error cerrando sesión:', error);
  }

  currentUser = null;
  currentProfile = null;

  registros = [];
  papeleraRegistros = [];
  perfiles = {};

  renderLista();
  renderPapelera();

  const password = document.getElementById('loginPassword');

  if (password) {
    password.value = '';
  }

  mostrarLogin();
}


/* =========================
   ENTER EN LOGIN
   ========================= */

const loginPassword =
  document.getElementById('loginPassword');

if (loginPassword) {
  loginPassword.addEventListener(
    'keydown',
    function (event) {
      if (event.key === 'Enter') {
        iniciarSesion();
      }
    }
  );
}


/* =========================
   SESIÓN / PERFIL
   ========================= */

async function cargarSesion(user) {
  if (!user) {
    mostrarLogin();
    return;
  }

  currentUser = user;

  const { data: profile, error } =
    await supabaseClient
      .from('profiles')
      .select('id,nombre,role')
      .eq('id', user.id)
      .maybeSingle();

  if (error || !profile) {
    console.warn('Perfil no disponible en este módulo. Se conserva la sesión de Supabase.', error);
    currentProfile = profile || null;
    const userName = document.getElementById('userName');
    if (userName) {
      userName.textContent = user.email || 'Usuario';
    }
    ocultarLogin();
    await cargarRegistros();
    return;
  }

  currentProfile = profile;

  const btnImportarExcel = document.getElementById('btnImportarExcel');
  if (btnImportarExcel) {
    btnImportarExcel.style.display = profile.role === 'admin' ? 'block' : 'none';
  }

  const userName =
    document.getElementById('userName');

  if (userName) {
    userName.textContent =
      profile.nombre +
      (profile.role === 'admin'
        ? ' · ADMIN'
        : '');
  }

  ocultarLogin();

  await cargarRegistros();
  if(profile.role==='admin'){
    setTimeout(()=>importarDatosExcel(true).catch(console.error),300);
  }
}


/* =========================
   CAMBIOS DE SESIÓN
   ========================= */

supabaseClient.auth.onAuthStateChange(
  async function (event, session) {

    if (event === 'SIGNED_OUT') {

      currentUser = null;
      currentProfile = null;

      registros = [];
      papeleraRegistros = [];
      perfiles = {};

      renderLista();
      renderPapelera();

      mostrarLogin();
    }
  }
);


/* =========================
   INICIALIZAR
   ========================= */

function leerSesionLocalGuardada() {

  try {

    const raw = localStorage.getItem('bbva-sistema-auth');

    if (!raw) return null;

    const datos = JSON.parse(raw);

    if (datos && datos.user) return datos;

    if (datos && datos.currentSession && datos.currentSession.user) {
      return datos.currentSession;
    }

    return null;

  } catch (e) {

    return null;

  }
}


async function inicializar() {

  mostrarLoading(true);

  const TIMEOUT = 15000;

  const timeout = function (ms) {
    return new Promise(function (_, reject) {
      setTimeout(
        function () {
          reject(new Error('TIMEOUT'));
        },
        ms
      );
    });
  };

  try {

    const resultado =
      await Promise.race([
        supabaseClient.auth.getSession(),
        timeout(TIMEOUT)
      ]);

    const session =
      resultado &&
      resultado.data
        ? resultado.data.session
        : null;

    mostrarLoading(false);

    if (session && session.user) {

      try {

        await Promise.race([
          cargarSesion(session.user),
          timeout(TIMEOUT)
        ]);

      } catch (error) {

        console.error(
          'No se pudo cargar la sesión/perfil:',
          error
        );

        // Se conserva la sesión aunque la carga del perfil tarde.
        currentUser = (session && session.user) ? session.user : currentUser;
        if(currentUser){ ocultarLogin(); }

        mostrarErrorLogin(
          'La conexión con Supabase está tardando. ' +
          'Vuelve a intentar iniciar sesión.'
        );
      }

    } else {

      mostrarLogin();

    }

  } catch (error) {

    console.error(
      'Error al iniciar:',
      error
    );

    mostrarLoading(false);

    // La conexión tardó demasiado: se intenta recuperar la sesión ya
    // guardada en este dispositivo para no pedir la contraseña otra vez.
    const sesionLocal = leerSesionLocalGuardada();

    if (sesionLocal && sesionLocal.user) {

      try {

        await cargarSesion(sesionLocal.user);

      } catch (e) {

        console.error('No se pudo recargar los registros:', e);

        currentUser = sesionLocal.user;
        ocultarLogin();

        mostrarErrorLogin(
          'La conexión está lenta. Actualiza la página cuando mejore tu señal.'
        );

      }

    } else {

      mostrarLogin();

      mostrarErrorLogin(
        'No se pudo conectar con el sistema. ' +
        'Recarga la página e inténtalo nuevamente.'
      );

    }
  }
}


/* =========================
   CARGAR PERFILES
   ========================= */

async function cargarPerfiles() {

  perfiles = {};

  if (!currentUser) {
    return;
  }

  if (
    !currentProfile ||
    currentProfile.role !== 'admin'
  ) {

    perfiles[currentUser.id] =
      currentProfile?.nombre || '';

    return;
  }

  const { data, error } =
    await supabaseClient
      .from('profiles')
      .select('id,nombre,role');

  if (error) {

    console.error(
      'Error cargando perfiles:',
      error
    );

    return;
  }

  (data || []).forEach(function (p) {
    perfiles[p.id] = p.nombre;
  });
}


/* =========================================================
   IMPORTAR DATOS DEL EXCEL · HOJA BBVA → MÓDULO 4
   Solo administrador. Los duplicados por DNI o número se omiten.
   ========================================================= */
async function importarDatosExcel(silencioso=false){
  if(!currentProfile || currentProfile.role!=='admin'){
    alert('Solo el administrador puede importar los datos del Excel.');
    return;
  }

  if(!silencioso && !confirm('Se cargarán los datos de la hoja BBVA del Excel en Módulo 4.\n\nLos DNI o números que ya existan se omitirán.\n\n¿Continuar?')) return;

  const btn=document.getElementById('btnImportarExcel');
  if(btn){btn.disabled=true;btn.textContent='⏳ Importando BBVA...';}

  try{
    const resp=await fetch('../import_excel/bbva.json',{cache:'no-store'});
    if(!resp.ok) throw new Error('No se encontró el archivo de datos BBVA.');
    const datos=await resp.json();

    /*
      IMPORTANTE:
      La restricción bbva_numero_unique / bbva_dni_unique es global en la
      tabla. Por eso consultamos TODOS los módulos y también la papelera.
      Así una fila duplicada del Excel se omite y la importación continúa.
    */
    const {data:existentesDB,error:errorExistentes}=await supabaseClient
      .from('bbva_registros')
      .select('dni,numero,sino,eliminado');

    if(errorExistentes){
      throw new Error('No se pudieron comprobar los registros existentes: '+errorExistentes.message);
    }

    const existentesDni=new Set(
      (existentesDB||[])
        .map(r=>String(r.dni||'').trim())
        .filter(Boolean)
    );

    const existentesNumero=new Set(
      (existentesDB||[])
        .map(r=>String(r.numero||'').trim())
        .filter(Boolean)
    );

    /* Evita duplicados dentro del propio Excel. */
    const usadosDni=new Set();
    const usadosNumero=new Set();

    let maxCorrelativo=Math.max(
      0,
      ...((existentesDB||[]).length
        ? registros.map(r=>Number(r.correlativo)||0)
        : registros.map(r=>Number(r.correlativo)||0))
    );

    /*
      Buscamos el correlativo real directamente en Supabase para no reutilizar
      números si existen registros en papelera.
    */
    const {data:maxData,error:errorMax}=await supabaseClient
      .from('bbva_registros')
      .select('correlativo')
      .eq('sino','Módulo 4')
      .order('correlativo',{ascending:false})
      .limit(1);

    if(!errorMax && maxData && maxData.length){
      maxCorrelativo=Math.max(
        maxCorrelativo,
        Number(maxData[0].correlativo)||0
      );
    }

    let importados=0, omitidos=0, sinFoto=0, errores=0;

    for(let i=0;i<datos.length;i++){
      const r=datos[i];
      const dni=String(r.dni||'').trim();
      const numero=String(r.numero||'').trim();

      if(
        (dni && (existentesDni.has(dni)||usadosDni.has(dni))) ||
        (numero && (existentesNumero.has(numero)||usadosNumero.has(numero)))
      ){
        omitidos++;
        continue;
      }

      let qr_path=null;

      if(r.qr_archivo){
        const fr=await fetch('../'+r.qr_archivo,{cache:'no-store'});
        if(fr.ok){
          qr_path=await subirFoto(await fr.blob(),'qr');
        }else{
          sinFoto++;
        }
      }else{
        sinFoto++;
      }

      maxCorrelativo++;

      const {data,error}=await supabaseClient
        .from('bbva_registros')
        .insert({
          user_id:currentUser.id,
          correlativo:maxCorrelativo,
          dni:dni||null,
          cliente:r.cliente||null,
          numero:numero||null,
          latitud:null,
          longitud:null,
          qr_path,
          antes_path:null,
          despues_path:null,
          pago_path:null,
          sino:'Módulo 4',
          eliminado:false
        })
        .select()
        .single();

      if(error){
        if(qr_path){
          await supabaseClient.storage.from(BUCKET).remove([qr_path]);
        }

        /*
          Si otro registro ya tiene el mismo número/DNI, NO detenemos toda
          la importación. Se omite únicamente esta fila y se continúa.
        */
        const msg=String(error.message||'').toLowerCase();
        const esDuplicado =
          msg.includes('duplicate key') ||
          msg.includes('unique constraint') ||
          msg.includes('bbva_numero_unique') ||
          msg.includes('bbva_dni_unique');

        if(esDuplicado){
          if(numero) existentesNumero.add(numero);
          if(dni) existentesDni.add(dni);
          omitidos++;
          continue;
        }

        errores++;
        console.error('Error importando fila Excel '+r.fila_excel+':',error);
        continue;
      }

      registros.push(data);

      if(dni){
        usadosDni.add(dni);
        existentesDni.add(dni);
      }

      if(numero){
        usadosNumero.add(numero);
        existentesNumero.add(numero);
      }

      importados++;

      if(btn){
        btn.textContent=`⏳ BBVA ${i+1}/${datos.length}`;
      }
    }

    await prepararUrlsFotos();
    siguienteCorrelativo();
    renderLista();

    const mensaje=
      `Importación BBVA terminada.\n\n`+
      `Importados: ${importados}\n`+
      `Omitidos por duplicado: ${omitidos}\n`+
      `Sin foto QR: ${sinFoto}`+
      (errores ? `\nErrores no duplicados: ${errores}` : '');

    if(!silencioso){
      alert('✅ '+mensaje);
    }else{
      console.log('Importación BBVA automática:',mensaje);
    }

  }catch(error){
    console.error('Importación BBVA:',error);
    alert('❌ No se pudo completar la importación.\n\n'+error.message);
  }finally{
    if(btn){
      btn.disabled=false;
      btn.textContent='📥 Cargar datos BBVA del Excel';
    }
  }
}

/* =========================
   CARGAR REGISTROS ONLINE
   ========================= */

async function cargarRegistros() {

  if (!currentUser) {
    return;
  }

  const { data, error } =
    await supabaseClient
      .from('bbva_registros')
      .select('*')
      .eq('sino', 'Módulo 4')
      .order('correlativo', {
        ascending: true
      });

  if (error) {

    console.error(
      'Error cargando registros:',
      error
    );

    alert(
      'No se pudieron cargar los registros:\n\n' +
      error.message
    );

    return;
  }

  const todos = data || [];

  registros = todos.filter(function (r) {
    return r.eliminado !== true;
  });

  papeleraRegistros = todos.filter(function (r) {
    return r.eliminado === true;
  });

  await cargarPerfiles();

  await prepararUrlsFotos();

  await prepararUrlsPapelera();

  siguienteCorrelativo();

  renderLista();

  renderPapelera();
}


/* =========================
   URL DE FOTOS ACTIVAS
   ========================= */

async function prepararUrlsFotos() {

  const paths = [];

  registros.forEach(function (r) {

    if (r.qr_path) {
      paths.push(r.qr_path);
    }

    if (r.antes_path) {
      paths.push(r.antes_path);
    }

    if (r.despues_path) {
      paths.push(r.despues_path);
    }
  });

  const unique = [
    ...new Set(paths)
  ];

  if (!unique.length) {
    return;
  }

  const { data, error } =
    await supabaseClient
      .storage
      .from(BUCKET)
      .createSignedUrls(
        unique,
        3600
      );

  if (error) {

    console.error(
      'Error creando URLs firmadas:',
      error
    );

    return;
  }

  const urlMap = {};

  (data || []).forEach(function (item) {

    if (
      item.path &&
      item.signedUrl
    ) {
      urlMap[item.path] =
        item.signedUrl;
    }
  });

  registros.forEach(function (r) {

    r.qr_url =
      urlMap[r.qr_path] || '';

    r.antes_url =
      urlMap[r.antes_path] || '';

    r.despues_url =
      urlMap[r.despues_path] || '';
    r.pago_url =
      urlMap[r.pago_path] || '';
  });
}


/* =========================
   URL DE FOTOS PAPELERA
   ========================= */

async function prepararUrlsPapelera() {

  const paths = [];

  papeleraRegistros.forEach(function (r) {

    if (r.qr_path) {
      paths.push(r.qr_path);
    }

    if (r.antes_path) {
      paths.push(r.antes_path);
    }

    if (r.despues_path) {
      paths.push(r.despues_path);
    }
  });

  const unique = [
    ...new Set(paths)
  ];

  if (!unique.length) {
    return;
  }

  const { data, error } =
    await supabaseClient
      .storage
      .from(BUCKET)
      .createSignedUrls(
        unique,
        3600
      );

  if (error) {

    console.error(
      'Error creando URLs de papelera:',
      error
    );

    return;
  }

  const urlMap = {};

  (data || []).forEach(function (item) {

    if (
      item.path &&
      item.signedUrl
    ) {
      urlMap[item.path] =
        item.signedUrl;
    }
  });

  papeleraRegistros.forEach(function (r) {

    r.qr_url =
      urlMap[r.qr_path] || '';

    r.antes_url =
      urlMap[r.antes_path] || '';

    r.despues_url =
      urlMap[r.despues_path] || '';
    r.pago_url =
      urlMap[r.pago_path] || '';
  });
}


/* =========================
   SIGUIENTE CORRELATIVO
   ========================= */

function siguienteCorrelativo() {

  let max = 0;

  registros.forEach(function (r) {

    const numero =
      Number(r.correlativo) || 0;

    if (numero > max) {
      max = numero;
    }
  });

  const siguiente = max + 1;

  const elemento =
    document.getElementById('correlativo');

  if (elemento) {
    elemento.textContent =
      pad(siguiente);
  }
}


/* =====================================================
   CONSULTA DNI - SUPABASE EDGE FUNCTION
   ===================================================== */

async function consultarDNI(dni) {

  const msg =
    document.getElementById('dniMsg');

  if (!msg) {
    return;
  }

  msg.innerHTML =
    '<div class="hint">Consultando DNI...</div>';

  try {

    if (!/^\d{8}$/.test(dni)) {

      throw new Error(
        'El DNI debe tener exactamente 8 dígitos.'
      );
    }

    const { data, error } =
      await supabaseClient.functions.invoke(
        'consultar-dni',
        {
          body: {
            dni: dni
          }
        }
      );

    if (error) {

      console.error(
        'Error de Supabase:',
        error
      );

      throw new Error(
        error.message ||
        'No se pudo conectar con la consulta DNI.'
      );
    }

    console.log(
      'Respuesta DNI:',
      data
    );

    if (!data) {

      throw new Error(
        'La consulta no devolvió información.'
      );
    }

    if (data.success === false) {

      throw new Error(
        data.message ||
        'No se pudo consultar el DNI.'
      );
    }

    const nombre = (
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
    ).trim();

    if (!nombre) {

      throw new Error(
        'La API no devolvió el nombre para este DNI.'
      );
    }

    const clienteInput =
      document.getElementById('cliente');

    if (clienteInput) {

      clienteInput.value =
        nombre.toUpperCase();
    }

    msg.innerHTML =
      '<div class="ok">' +
      '✓ Cliente encontrado: ' +
      esc(nombre) +
      '</div>';

  } catch (error) {

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


/* =====================================================
   DETECTAR DNI ESCRITO
   SOLO UN EVENTO
   ===================================================== */

const dniInput =
  document.getElementById('dni');

const clienteInput =
  document.getElementById('cliente');


if (dniInput) {

  dniInput.addEventListener(
    'input',
    function () {

      let v =
        this.value
          .replace(/\D/g, '')
          .slice(0, 8);

      this.value = v;

      const msg =
        document.getElementById('dniMsg');

      if (!msg) {
        return;
      }

      msg.innerHTML = '';

      clearTimeout(dniTimer);

      if (v.length === 0) {

        if (clienteInput) {
          clienteInput.value = '';
        }

        return;
      }

      if (v.length < 8) {

        msg.innerHTML =
          '<div class="hint">' +
          'Faltan ' +
          (8 - v.length) +
          ' dígitos.' +
          '</div>';

        return;
      }

      dniTimer = setTimeout(
        function () {
          consultarDNI(v);
        },
        250
      );
    }
  );
}


/* =========================
   NUMERO BBVA DUPLICADO
   ========================= */

const numeroInput =
  document.getElementById('numero');


if (numeroInput) {

  numeroInput.addEventListener(
    'input',
    function (event) {

      const input =
        event.target;

      const v =
        input.value
          .replace(/\D/g, '');

      input.value = v;

      const msg =
        document.getElementById('numeroMsg');

      if (!msg) {
        return;
      }

      const duplicado =
        registros.some(function (r) {

          return String(
            r.numero || ''
          ) === v;
        });

      if (v.length >= 1 && duplicado) {

        msg.innerHTML =
          '<div class="warn">' +
          '⚠️ Este número ya aparece ' +
          'en los registros cargados.' +
          '</div>';

      } else {

        msg.innerHTML = '';
      }
    }
  );
}


/* =========================
   FOTOS
   ========================= */

function resizeImage(file) {

  return new Promise(
    function (resolve, reject) {

      const reader =
        new FileReader();

      reader.onload =
        function (event) {

          const img =
            new Image();

          img.onload =
            function () {

              const maxW = 1200;

              const scale =
                Math.min(
                  1,
                  maxW / img.width
                );

              const canvas =
                document.createElement(
                  'canvas'
                );

              canvas.width =
                Math.max(
                  1,
                  Math.round(
                    img.width * scale
                  )
                );

              canvas.height =
                Math.max(
                  1,
                  Math.round(
                    img.height * scale
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
                function (blob) {

                  if (!blob) {

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
                    blob: blob,
                    dataUrl: dataUrl
                  });

                },
                'image/jpeg',
                0.75
              );
            };

          img.onerror =
            function () {

              reject(
                new Error(
                  'Imagen no válida.'
                )
              );
            };

          img.src =
            event.target.result;
        };

      reader.onerror =
        function () {

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


/* =========================
   CONFIGURAR FOTO
   ========================= */

function setupPhotoBox(
  key,
  boxId,
  inputId
) {

  const box =
    document.getElementById(boxId);

  const input =
    document.getElementById(inputId);

  if (!box || !input) {
    return;
  }

  input.addEventListener(
    'change',
    async function () {

      if (
        !input.files ||
        !input.files[0]
      ) {
        return;
      }

      try {

        fotos[key] =
          await resizeImage(
            input.files[0]
          );

        renderPhotoBox(
          key,
          boxId
        );

      } catch (error) {

        console.error(
          'Error cargando foto:',
          error
        );

        alert(
          'No se pudo cargar la imagen.'
        );
      }
    }
  );
}


/* =========================
   MOSTRAR FOTO
   ========================= */

function renderPhotoBox(
  key,
  boxId
) {

  const box =
    document.getElementById(boxId);

  if (!box) {
    return;
  }

  if (fotos[key]) {

    box.classList.add('filled');

    box.innerHTML =
      `
      <img
        src="${fotos[key].dataUrl}"
        alt=""
      >

      <button
        type="button"
        class="remove"
        onclick="quitarFoto('${key}','${boxId}')">

        ✕

      </button>
      `;
  }
}


/* =========================
   QUITAR FOTO
   ========================= */

function quitarFoto(
  key,
  boxId
) {

  fotos[key] = null;

  rebuildPhotoBox(
    key,
    boxId
  );
}


/* =========================
   RECONSTRUIR FOTO
   ========================= */

function rebuildPhotoBox(
  key,
  boxId
) {

  const labels = {

    qr: [
      'FOTO QR<br>BBVA',
      'Obligatoria'
    ],

    antes: [
      'FOTO<br>ANTES',
      'Opcional'
    ],

    despues: [
      'FOTO<br>DESPUÉS',
      'Opcional'
    ],

    pago: [
      'CAPTURA<br>DE PAGO',
      'Opcional'
    ]
  };

  const datos =
    labels[key];

  if (!datos) {
    return;
  }

  const lbl = datos[0];
  const tag = datos[1];

  const box =
    document.getElementById(boxId);

  if (!box) {
    return;
  }

  box.classList.remove('filled');

  const reqClass =
    tag === 'Obligatoria'
      ? 'req'
      : 'hint';

  box.innerHTML =
    `
    <div class="cam">
      📷
    </div>

    <div class="lbl">
      ${lbl}
    </div>

    <div
      class="${reqClass}"
      style="${
        tag !== 'Obligatoria'
          ? 'margin:0;font-size:10px;'
          : ''
      }">

      ${tag}

    </div>

    <input
      type="file"
      accept="image/*"
      id="file-${key}">
    `;

  setupPhotoBox(
    key,
    boxId,
    'file-' + key
  );
}


/* =========================
   INICIAR FOTOS
   ========================= */

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

setupPhotoBox(
  'pago',
  'box-pago',
  'file-pago'
);


/* =========================
   SELECTOR DE UBICACIÓN MANUAL
   ========================= */
function abrirMapa(){
  const bg=document.getElementById('mapPickerBg');
  if(!bg || typeof L==='undefined'){
    alert('No se pudo cargar el mapa. Verifica tu conexión a Internet.');
    return;
  }

  const latInput=document.getElementById('latitud');
  const lngInput=document.getElementById('longitud');
  const lat=Number(latInput?.value);
  const lng=Number(lngInput?.value);

  // Si ya existe una ubicación guardada, se usa esa.
  // Si no existe, el mapa inicia centrado en Chimbote.
  ubicacionTemporal={
    lat:Number.isFinite(lat) ? lat : -9.0853,
    lng:Number.isFinite(lng) ? lng : -78.5783
  };

  bg.classList.add('show');

  setTimeout(()=>{
    if(!mapa){
      mapa=L.map('locationMap',{
        zoomControl:true,
        dragging:true,
        touchZoom:true,
        doubleClickZoom:true,
        scrollWheelZoom:true
      }).setView([ubicacionTemporal.lat,ubicacionTemporal.lng],14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,
        attribution:'&copy; OpenStreetMap contributors'
      }).addTo(mapa);

      // Tocar/clickear cualquier punto mueve la ubicación.
      mapa.on('click',e=>seleccionarPunto(e.latlng.lat,e.latlng.lng));
    }else{
      mapa.invalidateSize();
      mapa.setView([ubicacionTemporal.lat,ubicacionTemporal.lng],14);
    }

    seleccionarPunto(ubicacionTemporal.lat,ubicacionTemporal.lng);
  },100);
}

function seleccionarPunto(lat,lng){
  lat=Number(lat);
  lng=Number(lng);

  if(!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  ubicacionTemporal={lat:lat,lng:lng};

  if(marcadorMapa){
    marcadorMapa.setLatLng([lat,lng]);
  }else if(mapa){
    // El marcador también se puede arrastrar con el dedo.
    marcadorMapa=L.marker([lat,lng],{
      draggable:true,
      autoPan:true
    }).addTo(mapa);

    marcadorMapa.on('dragend',function(e){
      const p=e.target.getLatLng();
      seleccionarPunto(p.lat,p.lng);
    });
  }

  const el=document.getElementById('mapCoords');
  if(el){
    el.textContent='Latitud: '+lat.toFixed(6)+' · Longitud: '+lng.toFixed(6);
  }
}

function usarMiUbicacion(){
  if(!navigator.geolocation){
    alert('Tu navegador no permite obtener la ubicación GPS.');
    return;
  }

  const btn=document.getElementById('btnMiUbicacion');
  if(btn){
    btn.disabled=true;
    btn.textContent='📍 Buscando ubicación...';
  }

  navigator.geolocation.getCurrentPosition(
    function(position){
      const lat=position.coords.latitude;
      const lng=position.coords.longitude;

      seleccionarPunto(lat,lng);

      if(mapa){
        mapa.setView([lat,lng],16);
      }

      if(btn){
        btn.disabled=false;
        btn.textContent='📍 Mi ubicación';
      }
    },
    function(error){
      let mensaje='No se pudo obtener tu ubicación.';

      if(error.code===1){
        mensaje='Debes permitir el acceso a la ubicación en tu celular.';
      }else if(error.code===2){
        mensaje='No se pudo determinar tu ubicación. Intenta nuevamente.';
      }else if(error.code===3){
        mensaje='La búsqueda de ubicación tardó demasiado.';
      }

      alert(mensaje);

      if(btn){
        btn.disabled=false;
        btn.textContent='📍 Mi ubicación';
      }
    },
    {
      enableHighAccuracy:true,
      timeout:10000,
      maximumAge:0
    }
  );
}

function confirmarUbicacion(){
  if(ubicacionTemporal.lat===null || ubicacionTemporal.lng===null){
    alert('Selecciona una ubicación en el mapa.');
    return;
  }

  const lat=document.getElementById('latitud');
  const lng=document.getElementById('longitud');

  if(lat) lat.value=ubicacionTemporal.lat.toFixed(6);
  if(lng) lng.value=ubicacionTemporal.lng.toFixed(6);

  cerrarMapa();
}

function cerrarMapa(){
  document.getElementById('mapPickerBg')?.classList.remove('show');
}

function limpiarUbicacion(){
  const lat=document.getElementById('latitud');
  const lng=document.getElementById('longitud');

  if(lat) lat.value='';
  if(lng) lng.value='';

  ubicacionTemporal={lat:null,lng:null};

  if(marcadorMapa && mapa){
    mapa.removeLayer(marcadorMapa);
    marcadorMapa=null;
  }
}

function obtenerUbicacionRegistro(r){
  return {lat:r?.latitud??null,lng:r?.longitud??null};
}

/* =========================
   EDITAR REGISTRO
   ========================= */
function editarRegistro(id){
  const r=registros.find(x=>String(x.id)===String(id));
  if(!r) return;
  editandoId=r.id;
  document.getElementById('dni').value=r.dni||'';
  document.getElementById('cliente').value=r.cliente||'';
  document.getElementById('numero').value=r.numero||'';
  document.getElementById('latitud').value=r.latitud??'';
  document.getElementById('longitud').value=r.longitud??'';
  const btn=document.querySelector('[onclick="guardarRegistro()"]');
  if(btn) btn.innerHTML='💾 Guardar<br>cambios';
  const title=document.querySelector('.section-title');
  window.scrollTo({top:0,behavior:'smooth'});
}
async function actualizarRegistro(){
  if(!editandoId || !currentUser) return false;
  const dni=document.getElementById('dni')?.value.trim()||'';
  const cliente=document.getElementById('cliente')?.value.trim()||'';
  const numero=document.getElementById('numero')?.value.trim()||'';
  const lat=document.getElementById('latitud')?.value.trim()||null;
  const lng=document.getElementById('longitud')?.value.trim()||null;
  if(dni.length!==8){alert('El DNI debe tener 8 dígitos.');return false;}
  if(!numero){alert('Ingresa el número.');return false;}
  const dup=registros.some(r=>String(r.id)!==String(editandoId) && (String(r.dni||'').trim()===dni || String(r.numero||'').trim()===numero));
  if(dup){alert('El DNI o número ya pertenece a otro registro.');return false;}
  let nuevoPagoPath = null;
  try{
    if(fotos.pago){
      nuevoPagoPath = await subirFoto(fotos.pago.blob,'pago');
    }
  }catch(error){
    alert('❌ No se pudo subir la captura de pago: '+error.message);
    return false;
  }
  const cambios = {
    dni,cliente:cliente||null,numero,
    latitud:lat!==null?Number(lat):null,
    longitud:lng!==null?Number(lng):null
  };
  if(nuevoPagoPath) cambios.pago_path=nuevoPagoPath;
  const {error}=await supabaseClient.from('bbva_registros').update(cambios).eq('id',editandoId);
  if(error){alert('❌ No se pudo actualizar: '+error.message);return false;}
  alert('✅ Registro actualizado correctamente.');
  editandoId=null;
  const btn=document.querySelector('[onclick="guardarRegistro()"]');
  if(btn) btn.innerHTML='💾 Guardar<br>registro';
  await cargarRegistros();
  limpiarCampos();
  return true;
}

/* =========================
   LIMPIAR CAMPOS
   ========================= */

function limpiarCampos() {

  const dni =
    document.getElementById('dni');

  const cliente =
    document.getElementById('cliente');

  const numero =
    document.getElementById('numero');

  const sino =
    document.getElementById('sino');

  const dniMsg =
    document.getElementById('dniMsg');

  const numeroMsg =
    document.getElementById('numeroMsg');

  if (dni) {
    dni.value = '';
  }

  if (cliente) {
    cliente.value = '';
  }

  if (numero) {
    numero.value = '';
  }

  if (sino) {
    sino.value = 'Módulo 4';
  }

  if (dniMsg) {
    dniMsg.innerHTML = '';
  }

  if (numeroMsg) {
    numeroMsg.innerHTML = '';
  }

  clearTimeout(dniTimer);

  fotos = {
    qr: null,
    antes: null,
    despues: null,
    pago: null
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

  rebuildPhotoBox(
    'pago',
    'box-pago'
  );
}


/* =========================
   AGREGAR NUEVO
   ========================= */

async function agregarNuevo() {

  const dni =
    document.getElementById('dni')
      ?.value.trim() || '';

  const cliente =
    document.getElementById('cliente')
      ?.value.trim() || '';

  const numero =
    document.getElementById('numero')
      ?.value.trim() || '';

  if (
    dni ||
    cliente ||
    numero ||
    fotos.qr ||
    fotos.antes ||
    fotos.despues
  ) {

    const ok =
      await guardarRegistro();

    if (!ok) {
      return;
    }
  }

  limpiarCampos();

  const dniInputActual =
    document.getElementById('dni');

  if (dniInputActual) {
    dniInputActual.focus();
  }
}


/* =========================
   HASH DE FOTO
   ========================= */

async function hashBlob(blob) {

  const buffer =
    await blob.arrayBuffer();

  const digest =
    await crypto.subtle.digest(
      'SHA-256',
      buffer
    );

  return Array
    .from(new Uint8Array(digest))
    .map(function (b) {
      return b
        .toString(16)
        .padStart(2, '0');
    })
    .join('');
}


/* =========================
   SUBIR FOTO
   ========================= */

async function subirFoto(
  blob,
  key
) {

  const hash =
    await hashBlob(blob);

  const path =
    'modulo4/' +
    hash +
    '.jpg';

  const { error } =
    await supabaseClient
      .storage
      .from(BUCKET)
      .upload(
        path,
        blob,
        {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        }
      );

  if (error) {

    throw new Error(
      'Esta foto ya fue registrada ' +
      'o no se pudo subir: ' +
      error.message
    );
  }

  return path;
}


/* =========================================================
   IMPORTAR DATOS DEL EXCEL · HOJA BBVA → MÓDULO 4
   Importa registros y sus fotos desde import_excel/bbva.json.
   Los DNI, números o QR que ya existan se omiten.
   ========================================================= */
/* =========================
   GUARDAR REGISTRO
   ========================= */

async function guardarRegistro() {

  if (editandoId) return actualizarRegistro();

  if (guardando) {
    return false;
  }

  const dni =
    document.getElementById('dni')
      ?.value.trim() || '';

  const cliente =
    document.getElementById('cliente')
      ?.value.trim() || '';

  const numero =
    document.getElementById('numero')
      ?.value.trim() || '';

  const sino = 'Módulo 4';

  if (!currentUser) {

    alert(
      'Debes iniciar sesión.'
    );

    return false;
  }

  if (dni.length !== 8) {

    alert(
      'El DNI debe tener 8 dígitos.'
    );

    return false;
  }

  if (!numero) {

    alert(
      'Ingresa el número BBVA.'
    );

    return false;
  }

  if (!fotos.qr) {

    alert(
      'La foto del QR BBVA es obligatoria.'
    );

    return false;
  }


  /* =========================
     VALIDAR DNI
     ========================= */

  const dniDuplicado =
    registros.some(function (r) {

      return String(
        r.dni || ''
      ).trim() === dni;
    });

  if (dniDuplicado) {

    alert(
      'Este DNI ya aparece en los registros cargados.'
    );

    return false;
  }


  /* =========================
     VALIDAR NUMERO BBVA
     ========================= */

  const numeroDuplicado =
    registros.some(function (r) {

      return String(
        r.numero || ''
      ).trim() === numero;
    });

  if (numeroDuplicado) {

    alert(
      'Este número BBVA ya aparece en los registros cargados.'
    );

    return false;
  }


  guardando = true;

  const uploaded = [];

  try {

    /* =========================
       FOTO QR
       ========================= */

    const qr_path =
      await subirFoto(
        fotos.qr.blob,
        'qr'
      );

    uploaded.push(qr_path);


    /* =========================
       FOTO ANTES
       ========================= */

    let antes_path = null;

    if (fotos.antes) {

      antes_path =
        await subirFoto(
          fotos.antes.blob,
          'antes'
        );

      uploaded.push(
        antes_path
      );
    }


    /* =========================
       FOTO DESPUES
       ========================= */

    let despues_path = null;

    if (fotos.despues) {

      despues_path =
        await subirFoto(
          fotos.despues.blob,
          'despues'
        );

      uploaded.push(
        despues_path
      );
    }

    let pago_path = null;
    if (fotos.pago) {
      pago_path = await subirFoto(fotos.pago.blob,'pago');
      uploaded.push(pago_path);
    }


    /* =========================
       CORRELATIVO
       ========================= */

    let maxCorrelativo = 0;

    registros.forEach(
      function (r) {

        const c =
          Number(
            r.correlativo
          ) || 0;

        if (c > maxCorrelativo) {
          maxCorrelativo = c;
        }
      }
    );

    const nuevoCorrelativo =
      maxCorrelativo + 1;


    /* =========================
       INSERTAR EN SUPABASE
       ========================= */

    const { data, error } =
      await supabaseClient
        .from('bbva_registros')
        .insert({
          user_id: currentUser.id,
          correlativo: nuevoCorrelativo,
          dni: dni,
          cliente: cliente || null,
          numero: numero,
          latitud: document.getElementById('latitud')?.value ? Number(document.getElementById('latitud').value) : null,
          longitud: document.getElementById('longitud')?.value ? Number(document.getElementById('longitud').value) : null,
          qr_path: qr_path,
          antes_path: antes_path,
          despues_path: despues_path,
          pago_path: pago_path,
          sino: sino,
          eliminado: false
        })
        .select()
        .single();


    /* =========================
       ERROR INSERT
       ========================= */

    if (error) {

      if (uploaded.length) {

        await supabaseClient
          .storage
          .from(BUCKET)
          .remove(uploaded);
      }

      console.error(
        'Error guardando:',
        error
      );

      if (
        error.code === '23505'
      ) {

        alert(
          '❌ Ese registro ya existe en Supabase.'
        );

      } else {

        alert(
          '❌ No se pudo guardar:\n\n' +
          error.message
        );
      }

      return false;
    }


    /* =========================
       ACTUALIZAR LISTA
       ========================= */

    registros.push(data);

    const {
      data: profile
    } =
      await supabaseClient
        .from('profiles')
        .select(
          'id,nombre,role'
        )
        .eq(
          'id',
          data.user_id
        )
        .maybeSingle();

    if (profile) {

      perfiles[profile.id] =
        profile.nombre;
    }

    await prepararUrlsFotos();

    renderLista();

    siguienteCorrelativo();

    limpiarCampos();


    alert(
      '✅ Registro guardado correctamente.\n\n' +
      'Correlativo: ' +
      pad(data.correlativo)
    );

    return true;


  } catch (error) {

    console.error(
      'Error guardando registro:',
      error
    );

    if (uploaded.length) {

      await supabaseClient
        .storage
        .from(BUCKET)
        .remove(uploaded);
    }

    alert(
      '❌ No se pudo guardar el registro.\n\n' +
      (
        error.message ||
        'Error desconocido'
      )
    );

    return false;


  } finally {

    guardando = false;
  }
}


/* =========================
   ELIMINAR REGISTRO
   ========================= */

async function eliminarRegistro(id) {

  const r =
    registros.find(
      function (x) {
        return String(x.id) ===
          String(id);
      }
    );

  if (!r) {
    return;
  }

  if (
    !confirm(
      '¿Enviar este registro a la papelera?'
    )
  ) {
    return;
  }

  const { error } =
    await supabaseClient
      .from('bbva_registros')
      .update({
        eliminado: true
      })
      .eq(
        'id',
        r.id
      );

  if (error) {

    alert(
      '❌ No se pudo enviar a la papelera:\n\n' +
      error.message
    );

    return;
  }

  await cargarRegistros();
}


/* =========================
   RESTAURAR REGISTRO
   ========================= */

async function restaurarRegistro(id) {

  const r =
    papeleraRegistros.find(
      function (x) {
        return String(x.id) ===
          String(id);
      }
    );

  if (!r) {
    return;
  }

  if (
    !confirm(
      '¿Restaurar este registro?'
    )
  ) {
    return;
  }


  /* =========================
     COMPROBAR DUPLICADOS
     ========================= */

  const dniDuplicado =
    registros.some(function (registro) {

      return String(
        registro.dni || ''
      ).trim() ===
        String(
          r.dni || ''
        ).trim();
    });

  if (dniDuplicado) {

    alert(
      '❌ No se puede restaurar.\n\n' +
      'El DNI ya pertenece a otro registro activo.'
    );

    return;
  }


  const numeroDuplicado =
    registros.some(function (registro) {

      return String(
        registro.numero || ''
      ).trim() ===
        String(
          r.numero || ''
        ).trim();
    });

  if (numeroDuplicado) {

    alert(
      '❌ No se puede restaurar.\n\n' +
      'El número BBVA ya pertenece a otro registro activo.'
    );

    return;
  }


  const { error } =
    await supabaseClient
      .from('bbva_registros')
      .update({
        eliminado: false
      })
      .eq(
        'id',
        r.id
      );

  if (error) {

    alert(
      '❌ No se pudo restaurar:\n\n' +
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

function renderPapelera() {

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

  if (!titulo || !wrap) {
    return;
  }

  if (count) {
    count.textContent =
      papeleraRegistros.length;
  }

  if (
    papeleraRegistros.length === 0
  ) {

    titulo.style.display =
      'none';

    wrap.style.display =
      'none';

    wrap.innerHTML = '';

    return;
  }

  titulo.style.display =
    'flex';

  wrap.style.display =
    'block';

  wrap.innerHTML =
    papeleraRegistros
      .slice()
      .reverse()
      .map(function (r) {

        return `
          <div
            class="reg"
            style="opacity:.92;"
          >

            <div class="head">

              <div>

                <div class="corr">
                  #${pad(r.correlativo)}
                  —
                  ${esc(
                    r.cliente ||
                    'Sin nombre'
                  )}
                </div>

                <div class="meta">
                  DNI
                  ${esc(
                    r.dni ||
                    '—'
                  )}

                  · Número
                  ${esc(
                    r.numero ||
                    '—'
                  )}${(r.latitud!=null&&r.longitud!=null)?` · 📍 ${Number(r.latitud).toFixed(6)}, ${Number(r.longitud).toFixed(6)}`:''}
                </div>

              </div>

              <span
                class="badge"
              >
                ELIMINADO
              </span>

            </div>

            <button
              type="button"
              class="btn btn-outline"
              style="width:100%;margin-top:8px;"
              onclick="restaurarRegistro('${r.id}')"
            >
              ♻️ Restaurar registro
            </button>

          </div>
        `;
      })
      .join('');
}


/* =========================
   VER REGISTRO
   ========================= */

function verRegistro(id) {

  const r =
    registros.find(
      function (x) {
        return String(x.id) ===
          String(id);
      }
    );

  if (!r) {
    return;
  }

  const nombre =
    perfiles[r.user_id] ||
    '—';

  const modalTitle =
    document.getElementById(
      'modalTitle'
    );

  const modalBody =
    document.getElementById(
      'modalBody'
    );

  const modalBg =
    document.getElementById(
      'modalBg'
    );

  if (
    !modalTitle ||
    !modalBody ||
    !modalBg
  ) {
    return;
  }

  modalTitle.textContent =
    `#${pad(r.correlativo)} · ${
      r.cliente ||
      'Sin nombre'
    }`;

  let html =
    `
    <div class="hint">

      Trabajador:
      ${esc(nombre)}

      <br>

      DNI:
      ${esc(r.dni)}

      · Número:
      ${esc(r.numero)}

      ·
      ${esc(r.sino || '—')}

    </div>
    `;


  if (r.qr_url) {

    html +=
      `
      <div
        style="margin-top:10px;font-weight:700;font-size:12.5px;"
      >
        QR BBVA
      </div>

      <img
        src="${r.qr_url}"
        alt="QR BBVA"
      >
      `;
  }


  if (r.antes_url) {

    html +=
      `
      <div
        style="margin-top:10px;font-weight:700;font-size:12.5px;"
      >
        Antes
      </div>

      <img
        src="${r.antes_url}"
        alt="Antes"
      >
      `;
  }


  if (r.despues_url) {

    html +=
      `
      <div
        style="margin-top:10px;font-weight:700;font-size:12.5px;"
      >
        Después
      </div>

      <img
        src="${r.despues_url}"
        alt="Después"
      >
      `;
  }


  if(r.pago_url){
    html+=`
      <div style="margin-top:10px;font-weight:700;font-size:12.5px;">
        💳 Captura de pago
      </div>
      <img src="${r.pago_url}" alt="Captura de pago">
    `;
  }

  modalBody.innerHTML =
    html;

  modalBg.classList.add(
    'show'
  );
}


/* =========================
   CERRAR MODAL
   ========================= */

function cerrarModal() {

  const modal =
    document.getElementById(
      'modalBg'
    );

  if (modal) {

    modal.classList.remove(
      'show'
    );
  }
}


/* =========================
   LISTA DE REGISTROS
   ========================= */

function renderLista() {

  const wrap =
    document.getElementById(
      'lista'
    );

  const count =
    document.getElementById(
      'regCount'
    );

  if (!wrap) {
    return;
  }

  if (count) {

    count.textContent =
      registros.length;
  }

  if (
    registros.length === 0
  ) {

    wrap.innerHTML =
      '<div class="empty">' +
      'Aún no hay registros guardados.' +
      '</div>';

    return;
  }


  wrap.innerHTML =
    registros
      .slice()
      .reverse()
      .map(function (r) {

        const nombre =
          currentProfile?.role === 'admin'
            ? (
                perfiles[r.user_id] ||
                '—'
              )
            : '';

        const badge =
          r.sino
            ? `
              <span
                class="badge"
              >
                ${esc(r.sino)}
              </span>
            `
            : '';


        return `
          <div class="reg">

            <div class="head">

              <div>

                <div class="corr">

                  #${pad(r.correlativo)}
                  —

                  ${esc(
                    r.cliente ||
                    'Sin nombre'
                  )}

                </div>

                <div class="meta">

                  ${
                    nombre
                      ? '👤 ' +
                        esc(nombre) +
                        ' · '
                      : ''
                  }

                  DNI
                  ${esc(
                    r.dni ||
                    '—'
                  )}

                  · Número
                  ${esc(
                    r.numero ||
                    '—'
                  )}${(r.latitud!=null&&r.longitud!=null)?` · 📍 ${Number(r.latitud).toFixed(6)}, ${Number(r.longitud).toFixed(6)}`:''}

                </div>

              </div>

              ${badge}

            </div>


            <div
              class="thumbs"
              onclick="verRegistro('${r.id}')"
            >

              ${
                r.qr_url
                  ? `
                    <img
                      src="${r.qr_url}"
                      alt="QR"
                    >
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
                      alt="Antes"
                    >
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
                      alt="Después"
                    >
                  `
                  : `
                    <div class="ph">
                      DESP.
                    </div>
                  `
              }

            </div>


            <button type="button" class="btn btn-blue" onclick="editarRegistro('${r.id}')">✏️ Editar</button>
            <button
              type="button"
              class="del"
              onclick="eliminarRegistro('${r.id}')"
            >
              Eliminar
            </button>

          </div>
        `;
      })
      .join('');
}


/* =========================
   BLOB A DATA URL
   ========================= */

function blobToDataUrl(blob) {

  return new Promise(
    function (resolve, reject) {

      const reader =
        new FileReader();

      reader.onload =
        function () {
          resolve(
            reader.result
          );
        };

      reader.onerror =
        reject;

      reader.readAsDataURL(
        blob
      );
    }
  );
}


/* =========================
   EXPORTAR EXCEL
   SOLO QR BBVA
   ========================= */

async function exportarExcel() {

  if (
    registros.length === 0
  ) {

    alert(
      'No hay registros para exportar.'
    );

    return;
  }

  if (
    typeof ExcelJS ===
    'undefined'
  ) {

    alert(
      'No se pudo cargar el módulo de Excel. ' +
      'Recarga la página e inténtalo nuevamente.'
    );

    return;
  }

  try {

    mostrarLoading(true);

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      'Módulo 4 BBVA';

    workbook.created =
      new Date();

    const ws =
      workbook.addWorksheet(
        'MODULO 4'
      );


    ws.columns = [

      {
        header: 'CORRELATIVO',
        key: 'correlativo',
        width: 13
      },

      {
        header: 'TRABAJADOR',
        key: 'trabajador',
        width: 24
      },

      {
        header: 'CLIENTE',
        key: 'cliente',
        width: 32
      },

      {
        header: 'DNI',
        key: 'dni',
        width: 12
      },

      {
        header: 'NÚMERO BBVA',
        key: 'numero',
        width: 17
      },

      {
        header: 'MÓDULO',
        key: 'sino',
        width: 10
      },

      {
        header: 'FECHA',
        key: 'fecha',
        width: 20
      },

      {
        header: 'FOTO QR BBVA',
        key: 'qr',
        width: 22
      }
    ];


    const headerRow =
      ws.getRow(1);

    headerRow.font = {
      bold: true
    };

    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };

    headerRow.height = 24;


    for (
      const r of registros
    ) {

      const row =
        ws.addRow({

          correlativo:
            pad(r.correlativo),

          trabajador:
            perfiles[r.user_id] ||
            '',

          cliente:
            r.cliente ||
            '',

          dni:
            r.dni ||
            '',

          numero:
            r.numero ||
            '',

          sino:
            r.sino ||
            '',

          fecha:
            r.fecha
              ? new Date(
                  r.fecha
                ).toLocaleString(
                  'es-PE'
                )
              : '',

          qr: ''
        });


      row.height = 82;

      row.alignment = {
        vertical: 'middle'
      };


      if (r.qr_url) {

        try {

          const response =
            await fetch(
              r.qr_url
            );

          if (response.ok) {

            const blob =
              await response.blob();

            const dataUrl =
              await blobToDataUrl(
                blob
              );

            const imageId =
              workbook.addImage({
                base64: dataUrl,
                extension: 'jpeg'
              });

            ws.addImage(
              imageId,
              `H${row.number}:H${row.number}`
            );
          }

        } catch (imgError) {

          console.warn(
            'No se pudo insertar QR:',
            imgError
          );
        }
      }
    }


    const buffer =
      await workbook.xlsx.writeBuffer();

    const blob =
      new Blob(
        [buffer],
        {
          type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        'a'
      );

    a.href = url;

    a.download =
      'MODULO4_BBVA.xlsx';

    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);


  } catch (error) {

    console.error(
      'Error exportando:',
      error
    );

    alert(
      '❌ No se pudo exportar a Excel.\n\n' +
      (
        error.message ||
        'Error desconocido'
      )
    );

  } finally {

    mostrarLoading(false);
  }
}


/* =========================
   COPIA DE SEGURIDAD
   ========================= */

function crearCopiaSeguridad() {

  if (
    registros.length === 0
  ) {

    alert(
      'No hay registros para hacer una copia de seguridad.'
    );

    return;
  }


  const respaldo = {

    version: 2,

    aplicacion:
      'MODULO 4 BBVA',

    fechaBackup:
      new Date().toISOString(),

    registros:
      registros.map(
        function (r) {

          return {

            id: r.id,

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
          };
        }
      )
  };


  try {

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

    enlace.href =
      url;


    const fecha =
      new Date();

    const nombreFecha =
      fecha.getFullYear() +
      '-' +
      String(
        fecha.getMonth() + 1
      ).padStart(2, '0') +
      '-' +
      String(
        fecha.getDate()
      ).padStart(2, '0') +
      '_' +
      String(
        fecha.getHours()
      ).padStart(2, '0') +
      '-' +
      String(
        fecha.getMinutes()
      ).padStart(2, '0');


    enlace.download =
      'BACKUP_MODULO4_BBVA_' +
      nombreFecha +
      '.json';


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
      '✅ COPIA DE SEGURIDAD CREADA\n\n' +
      'Registros incluidos: ' +
      registros.length +
      '\n\n' +
      'Las fotos permanecen almacenadas en Supabase.'
    );


  } catch (error) {

    console.error(
      'Error creando backup:',
      error
    );

    alert(
      '❌ No se pudo crear la copia de seguridad.\n\n' +
      (
        error.message ||
        'Error desconocido'
      )
    );
  }
}


/* =========================
   RESTAURAR COPIA
   ========================= */

async function restaurarCopia(event) {

  const file =
    event.target.files?.[0];

  event.target.value = '';

  if (!file) {
    return;
  }

  alert(
    'La restauración desde JSON se mantiene como respaldo.\n\n' +
    'Para recuperar registros eliminados, utiliza la Papelera y el botón "Restaurar registro".'
  );
}


/* =========================
   INICIO DEL SISTEMA
   ========================= */

inicializar();