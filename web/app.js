var OV;
var session;
var publisher;
var subscriber;
var subArr = [];
function initSession() {
  var sessionId = localStorage.getItem('sessionId');
  if (sessionId) {
    joinSession(true);
    $('#session').show();
  } else {
    $('#join').show();
  }
}

function joinSession(isOpen) {
  var name;
  var mySessionId;

  if (isOpen) {
    name = localStorage.getItem('name');
    mySessionId = localStorage.getItem('sessionId');
  } else {
    name = document.getElementById('name').value;
    mySessionId = makeid(7);

    localStorage.setItem('sessionId', mySessionId);
    localStorage.setItem('name', name);
  }
  // document.getElementById('sessionId').value = mySessionId;
  var payload = { name };

  OV = new OpenVidu();
  session = OV.initSession();

  session.on('streamCreated', function (event) {
    // get all the session videos
    var userData = JSON.parse(event.stream.connection.data);
    var targetElement = `
			<div id="${userData.name}">
			 <span>${userData.name}</span>
			</div>
	`;
    $('#subscriber').append(targetElement);
    subscriber = session.subscribe(event.stream, userData.name, {
      insertMode: 'APPEND',
    });

    subArr.push(subscriber);
    console.log('USER DATA: ' + event.stream.connection.data);
  });

  getToken(mySessionId).then((token) => {
    console.log(token, 'token');
    session
      .connect(token, JSON.stringify(payload))
      .then(() => {
        localStorage.setItem('sessionId', mySessionId);
        document.getElementById('session-header').innerText = mySessionId;
        document.getElementById('join').style.display = 'none';
        document.getElementById('session').style.display = 'block';

        // publish local stream
        publisher = OV.initPublisher('publisher');
        $('#publisher h3').text(name);
        // publish stream to session
        session.publish(publisher);
      })
      .catch((error) => {
        console.log(
          'There was an error connecting to the session:',
          error.code,
          error.message
        );
      });
  });
}

function stopRecievingData() {
  // hide users from showing on your feed
  subArr.forEach((sub) => session.unsubscribe(sub));
}

function muteYourself() {
  var isMute = localStorage.getItem('mute');

  if (!isMute) {
    isMute = false;
    localStorage.setItem('mute', 'false');
    jQuery('#mute-yourself').text('UnMute');
  } else {
    isMute = isMute === 'true' ? false : true;
    jQuery('#mute-yourself').text(isMute === 'true' ? 'Mute' : 'UnMute');
    localStorage.setItem('mute', isMute.toString());
  }

  publisher.publishAudio(isMute);
}

function hideYourself() {
  var isHide = localStorage.getItem('hide');

  if (!isHide) {
    isHide = false;
    localStorage.setItem('hide', 'false');
  } else {
    isHide = isHide === 'true' ? false : true;
    localStorage.setItem('hide', isHide.toString());
  }

  jQuery('#hide-yourself').text(isHide ? 'hide video' : 'show video');

  publisher.publishVideo(isHide);
}

function leaveSession() {
  session.disconnect();
  localStorage.removeItem('hide');
  localStorage.removeItem('mute');
  localStorage.removeItem('sessionId');
  localStorage.removeItem('name');
  document.getElementById('join').style.display = 'block';
  document.getElementById('session').style.display = 'none';
}

window.onbeforeunload = function () {
  if (session) session.disconnect();
};

/**
 * --------------------------
 * SERVER-SIDE RESPONSIBILITY
 * --------------------------
 * These methods retrieve the mandatory user token from OpenVidu Server.
 * This behavior MUST BE IN YOUR SERVER-SIDE IN PRODUCTION (by using
 * the API REST, openvidu-java-client or openvidu-node-client):
 *   1) Initialize a Session in OpenVidu Server	(POST /openvidu/api/sessions)
 *   2) Create a Connection in OpenVidu Server (POST /openvidu/api/sessions/<SESSION_ID>/connection)
 *   3) The Connection.token must be consumed in Session.connect() method
 */

var OPENVIDU_SERVER_URL = 'https://' + location.hostname + ':4443';
var OPENVIDU_SERVER_SECRET = 'MY_SECRET';

function makeid(length) {
  var result = '';
  var characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function getToken(mySessionId) {
  return createSession(mySessionId).then((sessionId) => createToken(sessionId));
}

function createSession(sessionId) {
  // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-openviduapisessions
  return new Promise((resolve, reject) => {
    $.ajax({
      type: 'POST',
      url: OPENVIDU_SERVER_URL + '/openvidu/api/sessions',
      data: JSON.stringify({ customSessionId: sessionId }),
      headers: {
        Authorization: 'Basic ' + btoa('OPENVIDUAPP:' + OPENVIDU_SERVER_SECRET),
        'Content-Type': 'application/json',
      },
      success: (response) => resolve(response.id),
      error: (error) => {
        if (error.status === 409) {
          resolve(sessionId);
        } else {
          console.warn(
            'No connection to OpenVidu Server. This may be a certificate error at ' +
              OPENVIDU_SERVER_URL
          );
          if (
            window.confirm(
              'No connection to OpenVidu Server. This may be a certificate error at "' +
                OPENVIDU_SERVER_URL +
                '"\n\nClick OK to navigate and accept it. ' +
                'If no certificate warning is shown, then check that your OpenVidu Server is up and running at "' +
                OPENVIDU_SERVER_URL +
                '"'
            )
          ) {
            location.assign(OPENVIDU_SERVER_URL + '/accept-certificate');
          }
        }
      },
    });
  });
}

function createToken(sessionId) {
  // See https://docs.openvidu.io/en/stable/reference-docs/REST-API/#post-openviduapisessionsltsession_idgtconnection
  return new Promise((resolve, reject) => {
    $.ajax({
      type: 'POST',
      url:
        OPENVIDU_SERVER_URL +
        '/openvidu/api/sessions/' +
        sessionId +
        '/connection',
      data: JSON.stringify({}),
      headers: {
        Authorization: 'Basic ' + btoa('OPENVIDUAPP:' + OPENVIDU_SERVER_SECRET),
        'Content-Type': 'application/json',
      },
      success: (response) => resolve(response.token),
      error: (error) => reject(error),
    });
  });
}
