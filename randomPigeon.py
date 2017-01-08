# randomPigeon.py <file> <fractionToKeep>
import json
import sys
import random

c_assign = 'assign'
c_query = 'query'
c_cn = 'cn'
c_a = 'a'
c_b = 'b'
c_v = 'v'

if __name__ == '__main__':
    trainingFileName = sys.argv[1]
    fraction = float(sys.argv[2])
    idToName = {}
    with open(trainingFileName, "r") as trainingFile:
        for line in trainingFile:
            line = line.rstrip('\n')
            try:
                singleProgramObject = json.loads(line)
            except ValueError:
                continue
            assign = singleProgramObject[c_assign]
            query = singleProgramObject[c_query]
            filteredQuery = [feature for feature in query if c_cn in feature or (random.random() <= fraction)]
            appeared = set()
            for feature in filteredQuery:
                if c_a in feature:
                    appeared.add(feature[c_a])
                if c_b in feature:
                    appeared.add(feature[c_b])
            singleProgramObject[c_query] = filteredQuery

            filteredAssign = [var for var in assign if var[c_v] in appeared]
            singleProgramObject[c_assign] = filteredAssign

            print json.dumps(singleProgramObject, separators=(',', ':'))

