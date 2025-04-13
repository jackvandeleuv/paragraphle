import scala.collection.mutable.ListBuffer

object Play extends Error {
    def main(args: Array[String]) = {
        val fileName = "data/embeddings2.jsonl"
        var lines = ListBuffer[String]()
        scala.io.Source.fromFile(fileName).getLines().foreach{ line => 
            lines += line            
        }    
        print(lines.length)
}
}

