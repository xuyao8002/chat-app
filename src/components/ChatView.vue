<template>
  <div id="app-container">
    <h1 class="app-header">{{ headerTitle }}</h1>
    <div id="main-content">
    <div id="sidebar">
      <ul id="user-list">
        <li v-for="(user, index) in users" :key="index" @click="selectUser(user)" :class="{ active: user === selectedUser }">
          <span>{{ user.friendName }}</span>
          <span v-if="user.unreadCount > 0" class="unread-badge">
            {{ user.unreadCount > 99 ? '99+' : user.unreadCount }}
          </span>
        </li>
      </ul>
    </div>
    <div id="chat" v-if="selectedUser">
      <div id="messages" ref="messagesContainer">
         <div v-for="(message, index) in messages" :key="index" 
              :class="{'received-message': message.toId !== selectedUser.friendId, 'sent-message': message.toId === selectedUser.friendId}">
            <span class="message-text">{{ message.msg }}</span>
          </div>
      </div>
      <textarea v-model="newMessage" @keyup.enter="sendMessage" placeholder="输入消息" ref="messageInput"></textarea>
      <div class="send-button-container">
            <button :disabled="!newMessage.trim()" @click="sendMessage" :class="{'send-button-disabled': !newMessage.trim(), 'send-button': newMessage.trim()}">发送</button>
      </div>
      <div v-if="messageError" style="color: red;">{{ messageError }}</div>
    </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import Cookie from 'js-cookie';

export default {
  data() {
    return {
      users: [],
      selectedUser: null,
      messages: [],
      allMessages: {},
      newMessage: '',
      messageError: '',
      ws: null, // WebSocket连接
      token: null,
      userId: -1
    };
  },
  computed: {
    headerTitle() {
      return this.selectedUser ? this.selectedUser.friendName : 'Chat';
    }
  },
  created(){
    this.token = this.checkToken();
    if(this.token){
      this.fetchUsers();
      this.connectWebSocket();
      setInterval(() => {this.readUserMessages(this.selectedUser);}, 2000);
    }
  },	
  watch: {
    // 监听selectedUser的变化，以便在切换用户时重新加载消息
    selectedUser(newValue, oldValue) {
      if (newValue) {
        this.messages = this.allMessages[newValue.friendId] || [];
      }
      this.readUserMessages(oldValue);
    }
  },
  beforeUnmount() {
    this.disconnectWebSocket();
  },
  methods: {
    readUserMessages(user){
        if(user){
          const lastMessage = this.allMessages[user.friendId]?.slice(-1)[0];
          if (lastMessage && lastMessage.isRead === 0){
            this.markMessagesAsRead(user.friendId);
            lastMessage.isRead = 1;
          }
        }
    },
    selectUser(user) {
      this.selectedUser = user;
      this.updateUnreadCount(user, 0);
      //this.markMessagesAsRead(user.friendId);
      this.readUserMessages(user);
      this.scrollToBottom();
    },
    sendMessage() {
      this.messageError = '';
      if (!this.newMessage.trim()) {
        this.messageError = '消息不能为空';
        return;
      }
      this.ws.send(JSON.stringify({ msg: this.newMessage, toId: this.selectedUser.friendId }));
      this.messages.push({msg: this.newMessage, fromId: this.userId, toId: this.selectedUser.friendId});
      this.allMessages[this.selectedUser.friendId] = this.messages;
      this.newMessage = '';
      this.scrollToBottom();
    },
    checkToken(){
      const token = Cookie.get('token');
      if(!token){
        this.$router.push('/login');
        return;
      }
      return token;
    },
    async fetchUsers() {
      try {
        const response = await axios.get('/api/friend/list', {
          params: {
            lastId: 0,
            size: 50
          }
        });
        if(response.data.code == 0 && response.data.message == '无访问权限'){
            Cookie.remove('token');
            this.checkToken();
        }else{

        this.users = response.data.data.map(item => ({
          userId: item.userId,
          friendId: item.friendId,
          friendName: item.friendName,
          unreadCount: 0
        }));
        await Promise.all(this.users.map(async user => {
          const messages = await this.fetchMessages(user.friendId);
          this.allMessages[user.friendId] = messages;
          user.unreadCount = await this.fetchUnreadCount(user.friendId);
        }));
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    },
    async fetchMessages(fromId) {
      try {
        const response = await axios.get('/api/message/list', {
          params: {
            toId: fromId,
            lastId: 0,
            pageSize: 10
          }
        });

        return response.data.data.map(msg => ({
          msg: msg.msg,
          fromId: msg.fromId,
          toId: msg.toId,
          isRead: msg.isRead
        })).reverse();
      } catch (error) {
        console.error('Failed to fetch messages:', error);
        return [];
      }
    },
    async fetchUnreadCount(fromId) {
      try {
        const response = await axios.get('/api/message/unreadCount', {
          params: {
            fromId: fromId
          }
        });
        return response.data.data;
      } catch (error) {
        console.error('Failed to fetch unreadCount:', error);
        return 0;
      }
    },
    updateUnreadCount(user, count) {
      const index = this.users.findIndex(u => u.friendId === user.friendId);
      if (index !== -1) {
        this.users[index].unreadCount = count;
      }
    },
    markMessagesAsRead(fromId) {
      // 发送POST请求标记消息为已读
      axios.post('/api/message/read', {},{
        params:{
          fromId: fromId
          }
       })
        .then(() => {
          console.log(`Messages with fromId ${fromId} marked as read.`);
        })
        .catch(error => {
          console.error(`Failed to mark messages as read for fromId ${fromId}:`, error);
        });
    },
    connectWebSocket() {
      if(this.token){
        this.ws = new WebSocket(`ws://${location.host}/ws/chat?token=${this.token}`);
      this.ws.onopen = () => {
        console.log('WebSocket connection opened.');
      };
      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed. code: ' + event.code);
        if(event.code != 1006 && event.code != 1001){
         setTimeout(() => {this.connectWebSocket()}, 1000);
        }
      };
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      this.ws.onmessage = (event) => {
        const messageData = JSON.parse(event.data);
        if (this.allMessages[messageData.fromId]) {
          this.allMessages[messageData.fromId].push({
            msg: messageData.msg,
            fromId: messageData.fromId,
            toId: messageData.toId,
            isRead: messageData.isRead
          });
        }
        if (this.selectedUser && this.selectedUser.friendId === messageData.fromId) {
          this.messages = this.allMessages[messageData.fromId];
          this.scrollToBottom(); // 滚动到底部
        }
        // 接收到消息后添加到消息列表
        //this.messages.push({ text: messageData.msg, from: 'server'});
        //this.scrollToBottom(); 
        if (messageData.fromId !== this.selectedUser?.friendId) {
          this.updateUnreadCount({ friendId: messageData.fromId }, this.users.find(u => u.userId === messageData.toId)?.unreadCount + 1 || 1);
        }
      };
      }
    },
    disconnectWebSocket() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
      }
    },
    scrollToBottom() {
      if (this.$refs.messagesContainer) {
        this.$nextTick(() => {
          this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
        });
      }
    }

  }
};
</script>

<style scoped>
#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-header {
  flex-shrink: 0;
  background-color: #f4f4f4;
  padding: 10px;
  text-align: center;
  width: 100%;
}

#main-content {
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  height: calc(100vh - 60px);
  overflow: hidden;
}

#sidebar {
  width: 20%;
  background-color: #f4f4f4;
  padding: 10px;
  overflow-y: auto;
}

#sidebar ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
  max-height: 100%;
}

#sidebar li {
  padding: 10px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  border-radius: 4px;
}

#sidebar li:hover {
  background-color: #ddd;
}

#sidebar li.active {
  background-color: #007BFF;
  color: white;
}

#chat {
  flex-grow: 1;
  padding: 10px;
  display: flex;
  flex-direction: column;
  width: 80%;
}

#messages {
  flex-grow: 1;
  overflow-y: scroll;
  border: 1px solid #ccc;
  padding: 10px;
  margin-bottom: 10px;
}

.received-message {
  text-align: left;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.sent-message {
  text-align: right;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.message-text {
  display: inline-block;
  background-color: #F0F0F0; /* 浅灰色背景 */
  padding: 10px;
  border-radius: 5px;
  max-width: 70%; /* 限制最大宽度 */
  word-wrap: break-word; /* 允许文本换行 */
}

.sent-message .message-text {
  background-color: #ADD8E6; /* 浅蓝色背景 */
  margin-left: auto; /* 右对齐 */
}

textarea {
  width: 100%;
  height: 100px;
  margin-bottom: 10px;
  resize: none;
  border: 1px solid #ccc;
  padding: 10px;
  border-radius: 4px;
}

.send-button-container {
  display: flex;
  justify-content: flex-end;
}

.send-button {
  padding: 10px;
  background-color: #007BFF;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 100px;
}

.send-button:hover {
  background-color: #0056b3;
}

.send-button-disabled {
  padding: 10px;
  background-color: #cccccc;
  color: #777777;
  border: none;
  border-radius: 4px;
  cursor: not-allowed;
  width: 100px;
}

/* 可选的滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.unread-badge {
  display: inline-block;
  background-color: #ff0000;
  color: #ffffff;
  border-radius: 50%;
  padding: 3px 6px;
  font-size: 12px;
  line-height: 1;
  margin-left: 5px;
}
</style>
