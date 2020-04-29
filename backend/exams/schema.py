import graphene

import categories.schema
import answers.schema
from graphene_django.debug import DjangoDebug


class Query(answers.schema.Query, categories.schema.Query, graphene.ObjectType):
    debug = graphene.Field(DjangoDebug, name='_debug')


schema = graphene.Schema(query=Query)