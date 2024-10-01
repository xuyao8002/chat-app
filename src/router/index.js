import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
//import Vue from 'vue';
//import Router from 'vue-router';
import RegisterView from '../components/RegisterView.vue';
import LoginView from '../components/LoginView.vue';
import ChatView from '../components/ChatView.vue';

//Vue.use(Router);

// const express = require('express');
// const cors = require('cors');
// const app = express();
// app.use(cors());

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/about',
    name: 'about',
    // route level code-splitting
    // this generates a separate chunk (about.[hash].js) for this route
    // which is lazy-loaded when the route is visited.
    component: () => import(/* webpackChunkName: "about" */ '../views/AboutView.vue')
  },
  { path: '/register', component: RegisterView },
  { path: '/login', component: LoginView },
  { path: '/chat', component: ChatView }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
