import graphene
from graphene_django import DjangoConnectionField, DjangoObjectType
import graphene_django_optimizer as gql_optimizer
from .models import Category as CategoryModel, CategoryMetaData as CategoryMetaDataModel, ExamCounts as ExamCountsModel, MetaCategory as MetaCategoryModel


class Category(DjangoObjectType):
    class Meta:
        model = CategoryModel
        interfaces = (graphene.relay.Node,)


class CategoryMetaData(DjangoObjectType):
    class Meta:
        model = CategoryMetaDataModel
        interfaces = (graphene.relay.Node,)


class ExamCounts(DjangoObjectType):
    class Meta:
        model = ExamCountsModel
        interfaces = (graphene.relay.Node,)


class MetaCategory(DjangoObjectType):
    class Meta:
        model = MetaCategoryModel
        interfaces = (graphene.relay.Node,)


class Query(graphene.ObjectType):
    categories = DjangoConnectionField(Category)

    def resolve_categories(self, info):
        return gql_optimizer.query(CategoryModel.objects.all(), info)

    categoryMetaData = DjangoConnectionField(CategoryMetaData)

    def resolve_categoryMetaData(self, info, **kwargs):
        return gql_optimizer.query(CategoryMetaDataModel.objects.all(), info)

    examCounts = DjangoConnectionField(ExamCounts)

    def resolve_examCounts(self, info, **kwargs):
        return gql_optimizer.query(ExamCountsModel.objects.all(), info)

    metaCategories = DjangoConnectionField(MetaCategory)

    def resolve_metaCategories(self, info, **kwargs):
        return gql_optimizer.query(MetaCategoryModel.objects.all(), info)
