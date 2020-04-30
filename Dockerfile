FROM eu.gcr.io/vseth-public/base:delta
LABEL maintainer='schmidbe@vis.ethz.ch'

WORKDIR /app

RUN mkdir intermediate_pdf_storage && chown app-user:app-user intermediate_pdf_storage

RUN apt-get install -y \
	python3 python3-pip python3-dev \
	smbclient poppler-utils

COPY ./backend/requirements.txt ./requirements.txt
RUN pip3 install -r requirements.txt

COPY cinit.yml /etc/cinit.d/community-solutions.yml

# prevent guincorn from buffering prints from python workers
ENV PYTHONUNBUFFERED True
COPY ./backend/ ./
RUN python3 manage.py graphql_schema --schema exams.schema.schema --out schema.json
EXPOSE 80
