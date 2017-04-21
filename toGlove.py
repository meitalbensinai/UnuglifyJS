# toGlove.py <file>
import json
import sys
import re

# usage: python toGlove.py <data.json>
# Limited, because:
# 1. Already extracted files do not contain giv-giv relations
# 2. Hashed paths cannot be reversed
# 3. So this script needs to be applied only to extracted giv-giv json's, and reversed paths if they are wished

DUMMY = 'DUMMY'

#def stripName(name):
#    return re.sub(r'[^a-zA-Z0-9]', '', name).lower()

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
            for feature in query:
                if not ('a' in feature and 'b' in feature and 'f2' in feature):
                    continue
                name1 = idToName[feature['a']]
                name2 = idToName[feature['b']]
                if feature['a'] == feature['b']:
                    name2 = 'self'
                path = feature['f2']
                print name1 + ' ' + path + ',' + name2

