# toGlove.py <file>
import json
import sys
import re

# Abandoned, because:
# 1. Already extracted files do not contain giv-giv relations
# 2. Hashed paths cannot be reversed

def stripName(name):
    return re.sub(r'[^a-zA-Z0-9]', '', name).lower()

if __name__ == '__main__':
    trainingFileName = sys.argv[1]
    idToName = {}
    with open(trainingFileName, "r") as trainingFile:
        for line in trainingFile:
            line = line.rstrip('\n')
            singleProgramObject = json.loads(line)
            assign = singleProgramObject['assign']
            query = singleProgramObject['query']
            for varItem in assign:
                name = ''
                if (varItem.has_key('inf')):
                    name = varItem['inf']
                elif varItem.has_key('giv'):
                    name = varItem['giv']
                id = varItem['v']
                if len(name) > 0:
                    idToName[id] = name
            for path in query:
                if not ('a' in path and 'b' in path and 'f2' in path):
                    continue
                name1 = idToName[path['a']]
                name2 = idToName[path['b']]
                strippedName1 = stripName(name1)
                strippedName2 = stripName(name2)
