import json
import sys

# usage: python countPaths.py <data.json>


if __name__ == '__main__':
    trainingFileName = sys.argv[1]
    path_count = 0
    files_count = 0
    with open(trainingFileName, "r") as trainingFile:
        for line in trainingFile:
            line = line.rstrip('\n')
            try:
                singleProgramObject = json.loads(line)
            except ValueError:
                print >> sys.stderr, 'Bad JSON: ' + str(line)
                continue
            files_count += 1
            query = singleProgramObject['query']
            path_count += len(query)
    print 'Files count: %d' % files_count
    print 'Features count: %d' % path_count
            

