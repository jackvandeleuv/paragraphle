from copy import copy

class Node:
    def __init__(self, left, right, items, token, level):
        self.left = left
        self.right = right
        self.token = token
        self.items = items
        self.level = level

class BTree:
    def __init__(self, head=None):
        self.__head = head

    def insert(self, string):
        if self.__head is None:
            my_string = copy(string)
            level = 1
            self.__head = Node(None, None, [my_string], my_string[: level], level)

    