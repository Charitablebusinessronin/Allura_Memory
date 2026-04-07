FROM autoagent-base

RUN pip install neo4j psycopg2-binary

COPY tests/ /tests/
RUN chmod +x /tests/test.sh
