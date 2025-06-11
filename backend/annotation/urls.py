from django.urls import path
from . import views

urlpatterns = [
    path('users/', views.get_users, name='user-list'),
    path('users/create/', views.create_user, name='user-create'),
    path('users/login/', views.login_user, name='user-login'),
    path('users/update/<int:pk>/', views.update_user, name='user-update'),

    path('projects/', views.list_projects, name='project-list'),
    path('projects/create/', views.create_project, name='project-create'),
    path('projects/<int:pk>/', views.get_project, name='project-detail'),
    path('projects/update/<int:pk>/', views.update_project, name='project-update'),
    path('projects/delete/<int:pk>/', views.delete_project, name='project-delete'),

    path('tasks/', views.get_tasks, name='get_tasks'),  
    path('task/<int:task_id>/', views.get_task, name='get_task'),  
    path('tasks/<int:task_id>/annotations/', views.get_annotations, name='get_annotations'),
    path('tasks/<int:task_id>/save_annotations/', views.save_annotations, name='save_annotations'),  
    path('tasks/<int:task_id>/export_annotations/', views.export_annotations, name='export_annotations'),
    path('annotations/<int:annotation_id>/', views.delete_annotation, name='delete_annotation'),
    path('projects/<int:pk>/', views.get_project, name='project-detail'),
    path('projects/update/<int:pk>/', views.update_project, name='project-update'),

]
