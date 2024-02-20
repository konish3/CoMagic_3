const div = document.createElement("div");
div.className = "acho-notification";

div.innerHTML = `
  <div class="_container">
        <div class="body">
          <div id="login-form" class="login-form_content">
            <h2 class="login-form_title">Введите данные для входа</h2>
            <div class="inputs">
              <input
                placeholder="Введите логин"
                id="loginText"
                type="text"
                class="inputs_login input"
              />
              <input
                placeholder="Введите пароль"
                id="passwordText"
                type="password"
                class="inputs_password input"
              />
            </div>
          </div>

          <div class="number-form d-none" id="callPanel">
            <div class="number-form_content">
              <p>Введите номер</p>
              <input
                id="callNumberText"
                type="text"
                class="input number-input"
                placeholder="Введите номер"
                onChange="handlerNumberInput"
              />
              <div id="about-call" class="number-form_about-call"></div>
              <div class="options">
                <span id="timer" class="number-form_time">00:00:00</span>
                <button id="historyBtn" class="btn options-btn">
                  История звонков
                </button>
              </div>
            </div>
            <button id="callNumberButton" type="button" class="btn btn-call">
              Позвонить
            </button>
            <button id="hangUpButton" type="button" class="btn btn-hang d-none">
              Завершить вызов
            </button>
          </div>

          <div id="historyForm" class="history d-none">
            <h4>История вызовов</h4>
              <div id="historyList" class="history_list">
                
              </div>
            <button id="backBtn" class="back-btn btn">← Назад</button>
          </div>
  
          <div id="mainButtons" class="buttons">
            <button id="loginButton" type="button" class="buttons_login btn">
              Войти
            </button>
            <button
              id="logOutButton"
              type="button"
              class="d-none buttons_logout btn"
            >
              Выйти
            </button>
          </div>
        </div>
  
        <audio id="localAudio" autoplay muted></audio>
        <audio id="remoteAudio" autoplay></audio>
        <audio id="sounds" autoplay></audio>
      </div>
  `;
const bodyElement = document.body;
bodyElement.appendChild(div);

console.log("sdsadsa");
// Поля ввода
let loginInput = document.getElementById("loginText");
let passwordInput = document.getElementById("passwordText");
let numberInput = document.getElementById("callNumberText");
// Кнопки
const loginBtn = document.getElementById("loginButton");
const logoutBtn = document.getElementById("logOutButton");
const callBtn = document.getElementById("callNumberButton");
const hangupBtn = document.getElementById("hangUpButton");
const historyBtn = document.getElementById("historyBtn");
const backBtn = document.getElementById("backBtn");
// Главные элементы
const loginForm = document.getElementById("login-form");
const callForm = document.getElementById("callPanel");
const historyForm = document.getElementById("historyForm");
const mainButtons = document.getElementById("mainButtons");
// Строка, показывающая этап вызова
const aboutCall = document.getElementById("about-call");

let _ua;
let socket;
let session;
let _localClonedStream;
let interval;

function loadPage() {
  console.log("on loadPage");

  loginInput = localStorage.getItem("login");
  passwordInput = localStorage.getItem("pwd");
  numberInput = localStorage.getItem("callNumber");

  this._soundsControl = document.getElementById("sounds");
}
loadPage();

loginBtn.addEventListener("click", () => {
  console.log("on login");

  let loginInput = document.getElementById("loginText");
  let passwordInput = document.getElementById("passwordText");

  socket = new JsSIP.WebSocketInterface("wss://voip.uiscom.ru");
  _ua = new JsSIP.UA({
    uri: "sip:" + loginInput.value + "@voip.uiscom.ru",
    password: passwordInput.value,
    display_name: loginInput.value,
    sockets: [socket],
  });

  console.log(_ua);

  // соединяемся с астером
  _ua.on("connecting", () => {
    console.log("UA connecting");
  });

  // соединились с астером
  _ua.on("connected", () => {
    console.log("UA connected");
  });

  // астер нас зарегал, теперь можно звонить и принимать звонки
  _ua.on("registered", () => {
    console.log("UA registered");

    loginBtn.classList.add("d-none");
    logoutBtn.classList.remove("d-none");
    loginInput.disabled = true;
    passwordInput.disabled = true;

    loginForm.classList.add("d-none");
    callForm.classList.remove("d-none");
  });

  // астер про нас больше не знает
  _ua.on("unregistered", () => {
    console.log("UA unregistered");
  });

  // астер не зарегал нас, что то не то, скорее всего неверный логин или пароль
  _ua.on("registrationFailed", (data) => {
    console.error("UA registrationFailed", data.cause);
  });

  _ua.start();
});

logoutBtn.addEventListener("click", () => {
  console.log("on logout");

  loginBtn.classList.remove("d-none");
  logoutBtn.classList.add("d-none");
  loginInput.disabled = false;
  passwordInput.disabled = false;

  callForm.classList.add("d-none");
  loginForm.classList.remove("d-none");

  _ua.stop();
});

callBtn.addEventListener("click", () => {
  let number = document.getElementById("callNumberText").value;
  localStorage.setItem("callNumber", number);

  callBtn.classList.add("d-none");
  hangupBtn.classList.remove("d-none");

  addCallInHistory(number);

  // Делаем ИСХОДЯЩИЙ звонок
  // Принимать звонки этот код не умеет!
  session = _ua.call(number, {
    pcConfig: {
      hackStripTcp: true, // Важно для хрома, чтоб он не тупил при звонке
      rtcpMuxPolicy: "negotiate", // Важно для хрома, чтоб работал multiplexing. Эту штуку обязательно нужно включить на астере.
      iceServers: [],
    },
    mediaConstraints: {
      audio: true, // Поддерживаем только аудио
      video: false,
    },
    rtcOfferConstraints: {
      offerToReceiveAudio: 1, // Принимаем только аудио
      offerToReceiveVideo: 0,
    },
  });

  // Астер нас соединил с абонентом
  session.on("connecting", () => {
    console.log("UA session connecting");
    playSound("ringback.ogg", true);

    // Тут мы подключаемся к микрофону и цепляем к нему поток, который пойдёт в астер
    let peerconnection = session.connection;
    let localStream = peerconnection.getLocalStreams()[0];

    // Handle local stream
    if (localStream) {
      // Clone local stream
      _localClonedStream = localStream.clone();

      console.log("UA set local stream");

      let localAudioControl = document.getElementById("localAudio");
      localAudioControl.srcObject = _localClonedStream;
    }

    // Как только астер отдаст нам поток абонента, мы его засунем к себе в наушники
    peerconnection.addEventListener("addstream", (event) => {
      console.log("UA session addstream");

      let remoteAudioControl = document.getElementById("remoteAudio");
      remoteAudioControl.srcObject = event.stream;
    });
  });

  // В процессе дозвона
  session.on("progress", () => {
    console.log("UA session progress");
    playSound("ringback.ogg", true);
    aboutCall.classList.add("yellow");
  });

  // Дозвон завершился неудачно, например, абонент сбросил звонок
  session.on("failed", (data) => {
    console.log("UA session failed", data);
    stopSound("ringback.ogg");
    playSound("rejected.mp3", false);

    aboutCall.classList.remove("green");
    aboutCall.classList.remove("yellow");
    aboutCall.classList.add("red");

    callBtn.classList.remove("d-none");
    hangupBtn.classList.add("d-none");

    setTimeout(() => {
      aboutCall.classList.remove("red");
    }, 3000);
  });

  // Поговорили, разбежались
  session.on("ended", () => {
    console.log("UA session ended");
    playSound("rejected.mp3", false);
    JsSIP.Utils.closeMediaStream(_localClonedStream);

    aboutCall.classList.remove("green");
    aboutCall.classList.add("red");

    callBtn.classList.remove("d-none");
    hangupBtn.classList.add("d-none");

    clearInterval(interval);

    setTimeout(() => {
      aboutCall.classList.remove("red");
    }, 3000);
    setTimeout(resetTime, 3000);
  });

  // Звонок принят, можно начинать говорить
  session.on("accepted", () => {
    console.log("UA session accepted");
    stopSound("ringback.ogg");
    playSound("answered.mp3", false);

    aboutCall.classList.remove("yellow");
    aboutCall.classList.add("green");

    interval = setInterval(updateTime, 1000);
  });
});

hangupBtn.addEventListener("click", () => {
  session.terminate();
  JsSIP.Utils.closeMediaStream(_localClonedStream);
});

historyBtn.addEventListener("click", () => {
  callForm.classList.add("d-none");
  historyForm.classList.remove("d-none");
  mainButtons.classList.add("d-none");
});

backBtn.addEventListener("click", () => {
  historyForm.classList.add("d-none");
  callForm.classList.remove("d-none");
  mainButtons.classList.remove("d-none");
});

function playSound(soundName, loop) {
  this._soundsControl.pause();
  this._soundsControl.currentTime = 0.0;
  this._soundsControl.src = "../sounds/" + soundName;
  this._soundsControl.loop = loop;
  this._soundsControl.play();
}

function stopSound() {
  this._soundsControl.pause();
  this._soundsControl.currentTime = 0.0;
}

const list = document.getElementById("historyList");
list.addEventListener("click", (e) => {
  callForm.classList.remove("d-none");
  historyForm.classList.add("d-none");
  mainButtons.classList.remove("d-none");

  callBtn.classList.add("d-none");
  hangupBtn.classList.remove("d-none");

  session = _ua.call(e.target.id, {
    pcConfig: {
      hackStripTcp: true, // Важно для хрома, чтоб он не тупил при звонке
      rtcpMuxPolicy: "negotiate", // Важно для хрома, чтоб работал multiplexing. Эту штуку обязательно нужно включить на астере.
      iceServers: [],
    },
    mediaConstraints: {
      audio: true, // Поддерживаем только аудио
      video: false,
    },
    rtcOfferConstraints: {
      offerToReceiveAudio: 1, // Принимаем только аудио
      offerToReceiveVideo: 0,
    },
  });
  // Астер нас соединил с абонентом
  session.on("connecting", () => {
    console.log("UA session connecting");
    playSound("ringback.ogg", true);
    // console.log(start_time());

    // Тут мы подключаемся к микрофону и цепляем к нему поток, который пойдёт в астер
    let peerconnection = session.connection;
    let localStream = peerconnection.getLocalStreams()[0];

    // Handle local stream
    if (localStream) {
      // Clone local stream
      _localClonedStream = localStream.clone();

      console.log("UA set local stream");

      let localAudioControl = document.getElementById("localAudio");
      localAudioControl.srcObject = _localClonedStream;
    }

    // Как только астер отдаст нам поток абонента, мы его засунем к себе в наушники
    peerconnection.addEventListener("addstream", (event) => {
      console.log("UA session addstream");

      let remoteAudioControl = document.getElementById("remoteAudio");
      remoteAudioControl.srcObject = event.stream;
    });
  });

  // В процессе дозвона
  session.on("progress", () => {
    console.log("UA session progress");
    playSound("ringback.ogg", true);
    aboutCall.classList.add("yellow");
  });

  // Дозвон завершился неудачно, например, абонент сбросил звонок
  session.on("failed", (data) => {
    console.log("UA session failed", data);
    stopSound("ringback.ogg");
    playSound("rejected.mp3", false);

    aboutCall.classList.remove("green");
    aboutCall.classList.remove("yellow");
    aboutCall.classList.add("red");

    callBtn.classList.remove("d-none");
    hangupBtn.classList.add("d-none");

    setTimeout(() => {
      aboutCall.classList.remove("red");
    }, 3000);
  });

  // Поговорили, разбежались
  session.on("ended", () => {
    console.log("UA session ended");
    playSound("rejected.mp3", false);
    JsSIP.Utils.closeMediaStream(_localClonedStream);

    aboutCall.classList.remove("green");
    aboutCall.classList.add("red");

    callBtn.classList.remove("d-none");
    hangupBtn.classList.add("d-none");

    clearInterval(interval);

    setTimeout(() => {
      aboutCall.classList.remove("red");
    }, 3000);
    setTimeout(resetTime, 3000);
  });

  // Звонок принят, можно начинать говорить
  session.on("accepted", () => {
    console.log("UA session accepted");
    stopSound("ringback.ogg");
    playSound("answered.mp3", false);
    interval = setInterval(updateTime, 1000);
    aboutCall.classList.remove("yellow");
    aboutCall.classList.add("green");
  });
});

function addCallInHistory(number) {
  // const list = document.getElementById("historyList");
  const div = document.createElement("div");
  div.className = "history_item";
  div.id = `historyItem-${number}`;

  div.innerHTML = `
    <p>${number}</p>
    <button class="history_item-call" id="call-${number}">Вызов</button>
  `;
  list.append(div);
}

let seconds = 0;
let minutes = 0;
let hours = 0;
const timer = document.getElementById("timer");

function updateTime() {
  seconds++;
  if (seconds === 60) {
    minutes++;
    seconds = 0;
  }
  if (minutes === 60) {
    hours++;
    minutes = 0;
  }
  timer.textContent = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
function resetTime() {
  seconds = 0;
  minutes = 0;
  hours = 0;
  timer.textContent = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
let a;
let b;
