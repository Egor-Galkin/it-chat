import { useState, useEffect, useRef } from 'react';
import './App.css';

const API_URL = '/api';

function App() {
  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [chatId, setChatId] = useState('');
  
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isAuthenticated || !chatId) return;

    let isMounted = true;

    const pollNotifications = async () => {
      if (!isMounted) return;
      
      try {
        const response = await fetch(`${API_URL}/waInstance${idInstance}/receiveNotification/${apiTokenInstance}?receiveTimeout=5`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.warn('Green-API вернул ошибку при опросе:', response.status, errorText);
          return;
        }

        const data = await response.json();

        if (data && data.receiptId && data.body) {
          console.log('СЫРОЕ УВЕДОМЛЕНИЕ ОТ API:', data.body);

          await fetch(`${API_URL}/waInstance${idInstance}/deleteNotification/${apiTokenInstance}/${data.receiptId}`, {
            method: 'DELETE'
          });

          const msgData = data.body.messageData;
          
          const isText = msgData?.typeMessage === 'textMessage' || msgData?.typeMessage === 'extendedTextMessage';
          
          if (isText) {
            let messageText = "";
            if (msgData.typeMessage === 'textMessage') {
              messageText = msgData.textMessageData.textMessage;
            } else if (msgData.typeMessage === 'extendedTextMessage') {
              messageText = msgData.extendedTextMessageData.text;
            }

            const isOutgoing = data.body.typeWebhook === 'outgoingMessageReceived' || data.body.typeWebhook === 'outgoingAPIMessageReceived';
            
            const newMessage = {
              id: data.body.idMessage,
              text: messageText,
              sender: isOutgoing ? 'me' : 'them',
              timestamp: data.body.timestamp
            };

            setMessages(prev => {
              if (prev.some(msg => msg.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });
          }
        }
      } catch (err) {
        console.error('Сетевая ошибка при опросе уведомлений:', err);
      } finally {
        if (isMounted) {
          pollingRef.current = setTimeout(pollNotifications, 1000);
        }
      }
    };

    pollNotifications();

    return () => {
      isMounted = false;
      if (pollingRef.current) {
        clearTimeout(pollingRef.current);
      }
    };
  }, [isAuthenticated, chatId, idInstance, apiTokenInstance]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (idInstance.trim() && apiTokenInstance.trim()) {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Заполните все поля');
    }
  };

  const handleStartChat = (e) => {
    e.preventDefault();
    if (phoneNumber) {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      if (cleanNumber.length < 10) {
        setError('Некорректный номер телефона. Введите только цифры, например: 79991234567');
        return;
      }

      const newChatId = `${cleanNumber}@c.us`;
      console.log('Успешно сформирован chatId для отправки:', newChatId);
      
      setChatId(newChatId);
      setMessages([]); 
      setError('');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !chatId) return;

    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/waInstance${idInstance}/sendMessage/${apiTokenInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: chatId,
          message: inputMessage
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Ошибка сервера: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.idMessage) {
        const newMessage = {
          id: data.idMessage,
          text: inputMessage,
          sender: 'me',
          timestamp: Math.floor(Date.now() / 1000)
        };
        setMessages(prev => [...prev, newMessage]);
        setInputMessage('');
      } else {
        setError('Не удалось получить ID сообщения');
      }
    } catch (err) {
      console.error('Ошибка отправки:', err);
      setError(`Ошибка отправки: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Вход в MAX Chat</h2>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              id="idInstance"
              name="idInstance"
              placeholder="idInstance (только цифры)"
              value={idInstance}
              onChange={(e) => setIdInstance(e.target.value.replace(/\D/g, ''))}
              required
            />
            <input
              type="text"
              id="apiTokenInstance"
              name="apiTokenInstance"
              placeholder="apiTokenInstance"
              value={apiTokenInstance}
              onChange={(e) => setApiTokenInstance(e.target.value)}
              required
            />
            {error && <p className="error">{error}</p>}
            <button type="submit">Войти</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>MAX Chat</h3>
          <button className="logout-btn" onClick={() => { setIsAuthenticated(false); setChatId(''); setMessages([]); }}>Выйти</button>
        </div>
        <div className="new-chat-form">
          <form onSubmit={handleStartChat}>
            <input
              type="text"
              id="phoneNumber"
              name="phoneNumber"
              placeholder="Номер (например, 79991234567)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
            <button type="submit">Чат</button>
          </form>
        </div>
        {chatId && (
          <div className="active-chat-info">
            <p>Активный чат: {phoneNumber}</p>
          </div>
        )}
      </div>

      <div className="chat-area">
        {chatId ? (
          <>
            <div className="chat-header">
              <h3>{phoneNumber}</h3>
            </div>
            <div className="messages-list">
              {messages.map((msg) => (
                <div key={msg.id} className={`message ${msg.sender}`}>
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">
                    {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="message-input-form" onSubmit={handleSendMessage}>
              <input
                type="text"
                id="messageInput"
                name="messageInput"
                placeholder="Введите сообщение..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
              />
              <button type="submit" disabled={isLoading || !inputMessage.trim()}>
                {isLoading ? '...' : 'Отправить'}
              </button>
            </form>
            {error && <p className="error" style={{padding: '0 1rem', textAlign: 'center'}}>{error}</p>}
          </>
        ) : (
          <div className="no-chat-selected">
            <p>Введите номер телефона слева, чтобы начать чат</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;