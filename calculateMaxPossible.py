import sys

def loadHistogram(file):
    histogram = {}
    with open(file, "r") as open_file:
        for line in open_file:
            splitted_line = line.strip().split(",")
            count = splitted_line[1]
            key = splitted_line[0]
            histogram[key] = int(count)
    return histogram

if __name__ == '__main__':
    training_histogram = loadHistogram(sys.argv[0])
    test_histogram = loadHistogram(sys.argv[1])

    total = 0
    occurred = 0
    for name,count in test_histogram.iteritems():
        total = total + count
        if training_histogram.has_key(name):
            occurred = occurred + count

    print "Occurred in training: " + str(occurred)
    print "Total: " + str(total)
    print float(occurred)/total