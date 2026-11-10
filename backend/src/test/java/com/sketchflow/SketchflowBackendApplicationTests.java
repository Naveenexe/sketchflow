package com.sketchflow;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
@Disabled("Context load requires live PostgreSQL datasource; run BoardServiceTest for unit tests")
class SketchflowBackendApplicationTests {

	@Test
	void contextLoads() {
	}

}
