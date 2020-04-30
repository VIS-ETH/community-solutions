import graphene
from graphene_django import DjangoConnectionField, DjangoObjectType
import graphene_django_optimizer as gql_optimizer
from .models import Exam as ExamModel, ExamType as ExamTypeModel, AnswerSection as AnswerSectionModel, Answer as AnswerModel, Comment as CommentModel


class Exam(DjangoObjectType):
    class Meta:
        model = ExamModel
        interfaces = (graphene.relay.Node, )


class AnswerSection(DjangoObjectType):
    class Meta:
        model = AnswerSectionModel
        interfaces = (graphene.relay.Node, )


class ExamType(DjangoObjectType):
    class Meta:
        model = ExamTypeModel
        interfaces = (graphene.relay.Node, )


class Answer(DjangoObjectType):
    class Meta:
        model = AnswerModel
        interfaces = (graphene.relay.Node, )


class Comment(DjangoObjectType):
    class Meta:
        model = CommentModel
        interfaces = (graphene.relay.Node, )


class Query(graphene.ObjectType):
    exams = DjangoConnectionField(Exam)

    def resolve_exams(self, info, **kwargs):
        return gql_optimizer.query(ExamModel.objects.all(), info)

    exam = graphene.Field(Exam, filename=graphene.String())

    def resolve_exam(self, info, filename):
        return gql_optimizer.query(ExamModel.objects.filter(filename=filename), info)[0]

    examTypes = graphene.List(ExamType)

    def resolve_examTypes(self, info):
        return gql_optimizer.query(ExamTypeModel.objects.all(), info)

    answerSections = graphene.List(AnswerSection)

    def resolve_answerSections(self, info):
        return gql_optimizer.query(AnswerSectionModel.objects.all(), info)

    answers = graphene.List(Answer)

    def resolve_answers(self, info):
        return gql_optimizer(AnswerModel.objects.all(), info)

    comments = graphene.List(Comment)

    def resolve_comments(self, info):
        return gql_optimizer(CommentModel.objects.all(), info)
