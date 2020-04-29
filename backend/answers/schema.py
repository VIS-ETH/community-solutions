import graphene
from graphene_django import DjangoObjectType
import graphene_django_optimizer as gql_optimizer
from .models import Exam, AnswerSection

class ExamObjectType(DjangoObjectType):
    class Meta:
        model = Exam
        filter_fields = ['filename', 'displayname', 'category', 'public', 'resolve_alias', 'has_solution']
class AnswerSectionType(DjangoObjectType):
    class Meta:
        model = AnswerSection
        filter_fields = ['exam', 'author', 'page_num', 'name', 'hidden']
class Query(graphene.ObjectType):
    exams = graphene.List(ExamObjectType)
    def resolve_exams(self, info, **kwargs):
        return gql_optimizer.query(Exam.objects.all(), info)

    exam = graphene.Field(
        ExamObjectType,
        filename=graphene.String(),
    )
    def resolve_exam(root, info, filename):
        return gql_optimizer.query(Exam.objects.filter(filename=filename), info)[0]

    answerSections = graphene.List(AnswerSectionType)
    def resolve_answerSections(self, info, **kwargs):
        return gql_optimizer.query(AnswerSection.objects.all(), info)