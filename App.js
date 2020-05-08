import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import SockJS from 'sockjs-client';
import PropTypes from 'prop-types';

var Stomp = require('stompjs/lib/stomp').Stomp;

export default class App extends React.Component {
  static defaultProps = {
    onConnect: () => {},
    onDisconnect: () => {},
    getRetryInterval: count => {
      return 1000 * count;
    },
    headers: {},
    autoReconnect: true,
    debug: false,
  };
  /*
  static propTypes = {
    url: 'http://192.168.1.110:8040/chat',
    topics: ['public'],
    onConnect: PropTypes.func,
    onDisconnect: PropTypes.func,
    getRetryInterval: PropTypes.func,
    onMessage: PropTypes.func.isRequired,
    headers: PropTypes.object,
    autoReconnect: PropTypes.bool,
    debug: PropTypes.bool,
  };
*/
  constructor(props) {
    super(props);

    this.state = {
      connected: false,
    };

    this.subscriptions = new Map();
    this.retryCount = 0;
  }

  componentDidMount() {
    this.connect();
  }

  componentWillUnmount() {
    this.disconnect();
  }

  sendMsg() {
    var chatMessage = {
      sender: 'User2',
      content: 'A u mnie wszystko w porzadku co u Ciebie?',
      type: 'CHAT',
    };

    this.client.send('/app/chat.send', {}, JSON.stringify(chatMessage));
  }

  render() {
    return (
      <View>
        <TouchableOpacity
          onPress={() => {
            this.sendMsg();
          }}
          style={{height: 50, width: 100}}>
          <Text>CONNECT</Text>
        </TouchableOpacity>
      </View>
    );
  }

  _initStompClient = () => {
    // Websocket held by stompjs can be opened only once
    this.client = Stomp.over(new SockJS('http://192.168.1.110:8040/chat'));
    /*
    if (!this.props.debug) {
      this.client.debug = () => {};
    }
    */
  };

  _cleanUp = () => {
    this.setState({connected: false});
    this.retryCount = 0;
    this.subscriptions.clear();
  };

  /*
  _log = msg => {
    if (this.props.debug) {
      console.log(msg);
    }
  };
*/

  connect = () => {
    this._initStompClient();
    this.client.connect(
      {},
      () => {
        this.setState({connected: true});
        this.subscribe('/topic/public');
        this.props.onConnect();
      },
      error => {
        if (this.state.connected) {
          this._cleanUp();
          // onDisconnect should be called only once per connect
          this.props.onDisconnect();
        }
        if (this.props.autoReconnect) {
          this._timeoutId = setTimeout(
            this.connect,
            this.props.getRetryInterval(this.retryCount++),
          );
        }
      },
    );
  };
  onMessage(body){
    console.log(body);
  }
  onMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    console.log(message);
  }

  disconnect = () => {
    // On calling disconnect explicitly no effort will be made to reconnect
    // Clear timeoutId in case the component is trying to reconnect
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
    }
    if (this.state.connected) {
      this.subscriptions.forEach((subid, topic) => {
        this.unsubscribe(topic);
      });
      this.client.disconnect(() => {
        this._cleanUp();
        this.onDisconnected();
      });
    }
  };
  onDisconnected() {
    console.log('disconnected');
  }
  subscribe = topic => {
    let sub = this.client.subscribe(topic, msg => {
      this.onMessage(JSON.parse(msg.body));
    });
    this.subscriptions.set(topic, sub);
  };

  unsubscribe = topic => {
    let sub = this.subscriptions.get(topic);
    sub.unsubscribe();
    this.subscriptions.delete(topic);
  };


  // Below methods can be accessed by ref attribute from the parent component
  sendMessage = (topic, msg, opt_headers = {}) => {
    if (this.state.connected) {
      this.client.send(topic, opt_headers, msg);
    } else {
      console.error('Send error: SockJsClient is disconnected');
    }
  };
}
