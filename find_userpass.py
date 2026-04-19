import base64
import itertools
import string

# Common username/password combinations to try
common_pairs = [
    ('neo4j', 'neo4j'),
    ('neo4j', 'password'),
    ('neo4j', 'test'),
    ('admin', 'admin'),
    ('root', 'root'),
    ('user', 'user')
]

for user, pwd in common_pairs:
    encoded = base64.b64encode(f"{user}:{pwd}".encode()).decode()
    print(f"Trying {user}:{pwd} -> {encoded}")
