from django.urls import path
from . import views

urlpatterns = [
    path('users/', views.get_users, name='user-list'),
    path('users/create/', views.create_user, name='user-create'),
    path('users/login/', views.login_user, name='user-login'),
    path('users/update/<int:pk>/', views.update_user, name='user-update'),
]
