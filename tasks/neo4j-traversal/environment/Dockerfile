FROM autoagent-base

RUN pip install neo4j

COPY tests/ /tests/
RUN chmod +x /tests/test.sh
