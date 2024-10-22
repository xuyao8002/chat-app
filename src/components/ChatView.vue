<template>
  <div id="app-container">
    <header class="app-header">
      <div class="search-container">
        <input type="text" class="search-input" placeholder="查询好友" v-model="searchTerm" @input="filterUsers" @focus="toggleDropdown" ref="searchInput">
        <button class="add-user-button" @click="openAddUserTooltip" ref="addUserButton">
          +
        </button>
        <div class="user-dropdown" v-if="showDropdown && filteredUsers.length > 0" :style="dropdownStyle">
          <ul>
            <li v-for="(user, index) in filteredUsers" :key="index" @click="selectUser(user)">
              {{ user.friendName }}
            </li>
          </ul>
        </div>
      </div>
      <h1 class="app-header-title">{{ headerTitle }}</h1>
      <div class="username-link" @click="toggleLogoutModal">
        <a href="#">{{ currentUserName }}</a>
      </div>
    </header>
    <div id="main-content">
    <div id="sidebar">
      <ul id="user-list">
        <li v-for="(user, index) in users" :key="index" @click="selectUser(user)" :class="{ active: user === selectedUser }"  @contextmenu.prevent="handleRightClick($event, user)">
          <span>{{ user.friendName }}</span>
          <span v-if="user.unreadCount > 0" class="unread-badge">
            {{ user.unreadCount > 99 ? '99+' : user.unreadCount }}
          </span>
        </li>
      </ul>
    </div>
    <div class="delete-menu" v-if="showDeleteMenu" :style="deleteMenuPosition">
      <button @click="deleteFriend">删除好友</button>
      <button @click="closeDeleteMenu">取消</button>
    </div>
    <div id="chat" v-if="selectedUser">
      <div id="messages" ref="messagesContainer">
         <div v-if="selectedUser.hasMoreMessages" class="load-more-container">
            <a href="#" class="load-more-link" @click.prevent="loadMoreMessages(selectedUser)">查询更多消息</a>
         </div>
         <div v-for="(message, index) in messages" :key="index" 
              :class="{'received-message': message.toId !== selectedUser.friendId, 'sent-message': message.toId === selectedUser.friendId}">
            <div class="message-content">
              <span class="message-time">{{ message.createTime }}</span>
              <span class="message-text">{{ message.msg }}</span>
            </div>
          </div>
      </div>
      <textarea v-model="newMessage" @keyup.enter="sendMessage" placeholder="输入消息" ref="messageInput"></textarea>
      <div class="send-button-container">
            <button :disabled="!newMessage.trim()" @click="sendMessage" :class="{'send-button-disabled': !newMessage.trim(), 'send-button': newMessage.trim()}">发送</button>
      </div>
      <div v-if="messageError" style="color: red;">{{ messageError }}</div>
    </div>
    </div>
    <div class="tooltip" v-if="showAddUserTooltip" :style="tooltipStyle">
      <div class="tooltip-content">
        <form @submit.prevent="searchUser">
          <div class="tooltip-row">
            <label>用户ID:</label>
            <input type="text" v-model="userIdInput" placeholder="请输入用户ID" required>
            <button type="submit">查询</button>
          </div>
          <div class="tooltip-row" v-if="userId && userName">
            <label>用户ID:</label>
            <span>{{ userId }}</span>
            <label>用户名:</label>
            <span>{{ userName }}</span>
          </div>
          <div class="tooltip-row" v-if="userId && userName">
            <button type="button" @click="addFriend" :class="addButtonClass" :disabled="addButtonClass === 'hidden'">添加用户</button>
          </div>
        </form>
        <button @click="closeAddUserTooltip" class="close-button">关闭</button>
      </div>
    </div>
    <transition name="fade">
      <div class="logout-modal" v-if="showLogoutModal">
        <div class="modal-content">
          <p>确定要退出登录吗？</p>
          <button @click="doLogout">确定</button>
          <button @click="toggleLogoutModal">取消</button>
        </div>
      </div>
    </transition>
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
      //userId: -1,
      searchTerm: '',
      showDropdown: false,
      showAddUserModal: false,
      userIdInput: '', // 用户ID输入框
      userId: '', // 查询得到的用户ID
      userName: '', // 查询得到的用户名
      currentUserUserId: parseInt(Cookie.get('userId')),
      showAddUserTooltip: false, // 控制提示框显示状态
      tooltipPosition: { top: 0, left: 0 }, // 提示框位置
      showDeleteMenu: false, // 控制删除菜单显示状态
      selectedFriend: null, // 被选中的好友信息
      deleteMenuPosition: { top: 0, left: 0 }, // 删除菜单位置
      showLogoutModal: false, // 控制退出登录浮层显示状态
      currentUserName: '', // 存储当前用户名
    };
  },
  computed: {
    headerTitle() {
      return this.selectedUser ? this.selectedUser.friendName : 'Chat';
    },
    filteredUsers() {
      if (!this.searchTerm) {
        return this.users;
      }
      return this.users.filter(user => 
        user.friendName.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    },
    dropdownStyle() {
      // 获取 input 的位置信息
      const inputRect = this.$refs.searchInput?.getBoundingClientRect();
      if (inputRect) {
        return {
          position: 'absolute',
          top: `${inputRect.bottom}px`, // 输入框底部的位置
          left: `${inputRect.left}px`, // 输入框左边的位置
          width: `${inputRect.width}px`, // 输入框的宽度
        };
      }
      return {};
    },
    addButtonClass() {
      if (this.userId === this.currentUserUserId || this.users.some(u => u.friendId === this.userId)) {
        return 'hidden'; // 如果是自己或已添加的好友，设置为 hidden 类
      }
      return ''; // 否则不设置类
    },
    tooltipStyle() {
      return {
        position: 'absolute',
        top: `${this.tooltipPosition.top}px`,
        left: `${this.tooltipPosition.left}px`,
      };
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
        this.updateUserState(newValue);
      }
      this.readUserMessages(oldValue);
    }
  },
  mounted() {
    document.addEventListener('click', this.documentClickHandler);

    this.fetchUserName();
  },
  beforeUnmount() {
    this.disconnectWebSocket();
    document.removeEventListener('click', this.documentClickHandler);

  },
  methods: {
    handleRightClick(event, friend) {
      event.preventDefault(); // 阻止默认的右键行为
      this.showDeleteMenu = true;
      this.selectedFriend = friend;
      this.deleteMenuPosition = {
        top: event.clientY + 'px',
        left: event.clientX + 'px',
      };
    },
    deleteFriend() {
      const selectedFriendId = this.selectedFriend.friendId;
      axios.post('/api/friend/delete', null, { params: { friendId: selectedFriendId } })
        .then(response => {
          if (response.data.code === 1) {
            alert('删除好友成功！');
            if (this.selectedUser && this.selectedUser.friendId === selectedFriendId) {
              this.selectedUser = null; // 清除当前选中的用户
              this.resetChatSession(); // 重置聊天会话
            }
            this.fetchUsers(); // 刷新好友列表
          }
        })
        .catch(error => {
          console.error('Failed to delete friend:', error);
          alert('删除好友失败，请稍后再试！');
        });

      this.closeDeleteMenu();
    },
    resetChatSession() {
      // 清除聊天记录
      this.chatMessages = [];
      // 清除输入框
      this.messageInput = '';
      // 清除未读消息计数
      this.unreadCount = 0;
      // 可能还需要重置其他相关状态
    },
    closeDeleteMenu() {
      this.showDeleteMenu = false;
      this.selectedFriend = null;
    },
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
      this.showDropdown = false;
      this.updateUnreadCount(user, 0);
      //this.markMessagesAsRead(user.friendId);
      this.readUserMessages(user);
      this.scrollToBottom();
      this.searchTerm = '';
    },
    sendMessage() {
      this.messageError = '';
      if (!this.newMessage.trim()) {
        this.messageError = '消息不能为空';
        return;
      }
      this.ws.send(JSON.stringify({ msg: this.newMessage, toId: this.selectedUser.friendId }));
      const currentTime = this.formatDateTime();
      this.messages.push({msg: this.newMessage, fromId: this.userId, toId: this.selectedUser.friendId, createTime: currentTime});
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
          unreadCount: 0,
          lastId: 0,
          hasMoreMessages: true
        }));
        await Promise.all(this.users.map(async user => {
          const messages = await this.fetchMessages(user.friendId, user.lastId);
          this.allMessages[user.friendId] = messages;
          user.unreadCount = await this.fetchUnreadCount(user.friendId);
          this.updateUserState(user);
        }));
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    },
    async fetchMessages(fromId, lastId = 0) {
      try {
        const response = await axios.get('/api/message/list', {
          params: {
            toId: fromId,
            lastId: lastId,
            pageSize: 10
          }
        });
        const messages = response.data.data.map(msg => ({
          id: msg.id,
          msg: msg.msg,
          createTime: msg.createTime,
          fromId: msg.fromId,
          toId: msg.toId,
          isRead: msg.isRead
        })).reverse();
        return messages;
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
    updateUserState(user) {
      // 更新用户的 lastId 和 hasMoreMessages
      const messages = this.allMessages[user.friendId];
      const lastMessage = messages[0];
      user.lastId = lastMessage  ? lastMessage .id : 0;
      user.hasMoreMessages = messages.length === 10;
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
    loadMoreMessages(user) {
      if (user && user.hasMoreMessages) {
        this.fetchMessages(user.friendId, user.lastId)
          .then(messages => {
            // 将新获取的消息追加到当前消息列表
            this.messages = [...messages, ...this.messages];
            const firstMessage = messages[0];
            user.lastId = firstMessage ? firstMessage.id : user.lastId;
            user.hasMoreMessages = messages.length === 10;
            this.scrollToTop(); // 滚动到顶部
          });
      }
    },
    openAddUserTooltip() {
      this.showAddUserTooltip = true;
      this.calculateTooltipPosition(this.$refs.addUserButton);
    },
    calculateTooltipPosition(buttonRef) {
      const buttonRect = buttonRef.getBoundingClientRect();
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const scrollX = window.scrollX || document.documentElement.scrollLeft;

      // 计算相对于按钮的位置
      this.tooltipPosition = {
        top: buttonRect.bottom + 5 + scrollY, // 下方留5像素间距
        left: buttonRect.left + scrollX,
      };
    },
    closeAddUserTooltip() {
      this.showAddUserTooltip = false;
      this.userIdInput = ''; // 清空输入框
      this.userId = ''; // 清空查询结果
      this.userName = ''; // 清空查询结果
    },
    searchUser() {
      const userId = this.userIdInput.trim();
      if (userId) {
        axios.get('/api/user/get', { params: { userId } })
          .then(response => {
            const { userId, userName } = response.data.data;
            this.userId = userId;
            this.userName = userName;
            this.showAddUserTooltip = true;
          })
          .catch(error => {
            console.error('Failed to fetch user info:', error);
            alert('查询失败，请稍后再试！');
          });
      }
    },
    addFriend() {
      axios.post('/api/friend/add', null, { params: { friendId: this.userId } })
        .then(response => {
          if (response.data.code === 1) {
            alert('添加好友成功！');
            this.closeAddUserTooltip();
            this.fetchUsers(); // 刷新好友列表
          }
        })
        .catch(error => {
          console.error('Failed to add friend:', error);
          alert('添加好友失败，请稍后再试！');
        });
    },
    filterUsers() {
      this.showDropdown = true;
    },
    toggleDropdown() {
      this.showDropdown = true; // 显示下拉框
    },
    hideDropdown() {
      this.showDropdown = false; // 隐藏下拉框
    },
    documentClickHandler(event) {
      const searchInput = this.$refs.searchInput;
      const dropdown = this.$el.querySelector('.user-dropdown');
      
      if (
        !searchInput.contains(event.target) &&
        !dropdown?.contains(event.target)
      ) {
        this.hideDropdown();
      }
    },
    toggleLogoutModal() {
      this.showLogoutModal = !this.showLogoutModal;
    },
    doLogout() {
      // 关闭WebSocket连接
      this.disconnectWebSocket();

      // 调用后台退出登录接口
      axios.post('/api/user/logout')
        .then(response => {
          if (response.data.data === true) {
            // 页面跳转到登录页
            // 删除cookie中的token、userId、userName
            Cookie.remove('token');
            Cookie.remove('userId');
            Cookie.remove('userName');
            this.$router.push('/login');
          } else {
            alert('退出登录失败，请稍后再试！');
          }
        })
        .catch(error => {
          console.error('Failed to logout:', error);
          alert('退出登录失败，请稍后再试！');
        });

      this.toggleLogoutModal();
    },
    fetchUserName() {
      this.currentUserName = Cookie.get('userName') || '未知用户';
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
            createTime: this.formatDateTime(messageData.createTime),
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
    },
    scrollToTop() {
      if (this.$refs.messagesContainer) {
        this.$nextTick(() => {
          this.$refs.messagesContainer.scrollTop = 0;
        });
      }
    },
    formatDateTime(dateTime){
      const currentTime = (dateTime ? new Date(dateTime) : new Date()).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-').replace(',', '');
      return currentTime;
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

.message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}



.received-message,
.sent-message {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 10px;
}

.sent-message {
  justify-content: flex-end;
}

.message-meta {
  display: block;
  font-size: 0.8em;
  color: #999;
  margin-bottom: 5px;
}

.message-time {
  font-size: 0.8em;
  color: #999;
  margin-bottom: 5px;
}
.received-message .message-time {
  margin-left: 0;
  margin-right: auto;
}
.sent-message .message-time {
  margin-left: auto;
  margin-right: 0;
}

.message-text {
  display: inline-block;
  background-color: #F0F0F0; /* 浅灰色背景 */
  padding: 10px;
  border-radius: 5px;
  word-wrap: break-word; /* 允许文本换行 */
}
.received-message .message-text {
  margin-left: 0;
  margin-right: auto;
}
.sent-message .message-text {
  background-color: #ADD8E6; /* 浅蓝色背景 */
  margin-left: auto; /* 右对齐 */
  margin-right: 0;
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

/* 查询更多消息的样式 */
.load-more-container {
  text-align: center;
  padding: 10px;
}

.load-more-link {
  color: #007bff;
  cursor: pointer;
  text-decoration: none;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: #fff;
  border-bottom: 1px solid #ddd;
}

/* 搜索框 */
.search-container {
  flex: 0 0 200px; /* 固定宽度与 sidebar 一致 */
  display: flex;
  align-items: center;
}

.search-input {
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

/* 添加用户的按钮 */
.add-user-button {
  padding: 5px;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin-left: 8px;
}

/* 头部标题 */
.app-header-title {
  flex: 1; /* 占据剩余空间 */
  text-align: center; /* 文本居中 */
  font-size: 1.5em;
  font-weight: bold;
}
.user-dropdown {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  position: absolute;
}

.user-dropdown ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.user-dropdown li {
  padding: 8px;
  cursor: pointer;
}

.user-dropdown li:hover {
  background-color: #f0f0f0;
}
.tooltip {
  position: absolute;
  z-index: 1000;
  background-color: white;
  border: 1px solid #ccc;
  padding: 10px;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.3);
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.tooltip-row label {
  width: 60px;
}

.tooltip-row input {
  width: 200px;
}

.close-button {
  margin-top: 10px;
  width: 50px;
  margin-left: auto;
  margin-right: auto;
}

.hidden {
  display: none; /* 隐藏按钮 */
}

.add-user-button {
  position: relative; /* 确保按钮的位置可以获取 */
}
#user-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

#user-list li {
  cursor: pointer;
  padding: 8px 16px;
  border-bottom: 1px solid #ddd;
}

#user-list .active {
  background-color: #e9ecef;
}

#user-list .unread-badge {
  color: white;
  background-color: #dc3545;
  border-radius: 50%;
  padding: 2px 6px;
  font-size: 12px;
  margin-left: 5px;
}

.delete-menu {
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  padding: 10px;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.delete-menu button {
  display: block;
  width: 100%;
  margin: 5px 0;
  padding: 8px;
  text-align: center;
  cursor: pointer;
}

.logout-modal {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.username-link {
  float: right;
  cursor: pointer;
  margin-top: 10px;
  margin-right: 10px;
}
</style>
