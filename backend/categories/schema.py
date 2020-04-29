import graphene
from graphene_django import DjangoObjectType
from .models import Category

class CategoryType(DjangoObjectType):
    class Meta:
        model = Category
class Query(graphene.ObjectType):
    categories = graphene.List(CategoryType)

    def resolve_categories(self, info, **kwargs):
        return Category.objects.all()