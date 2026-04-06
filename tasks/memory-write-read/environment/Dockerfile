FROM autoagent-base

RUN pip install psycopg2-binary

COPY tests/ /tests/
RUN chmod +x /tests/test.sh
