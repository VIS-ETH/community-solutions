import graphene
from graphene_django import DjangoObjectType
from django.contrib.auth.models import User as UserModel
from myauth.models import MyUser


class User(DjangoObjectType):
    class Meta:
        model = UserModel


class Query(graphene.ObjectType):
    user = graphene.Field(User, username=graphene.String())

    def resolve_user(self, info, username):
        return MyUser.objects.get(username=username)
