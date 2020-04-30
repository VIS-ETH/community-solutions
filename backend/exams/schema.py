import graphene

import categories.schema
import answers.schema
import myauth.schema
from graphene_django.debug import DjangoDebug


class Query(myauth.schema.Query, answers.schema.Query, categories.schema.Query, graphene.ObjectType):
    node = graphene.relay.Node.Field()
    debug = graphene.Field(DjangoDebug, name='_debug')


schema = graphene.Schema(query=Query)
